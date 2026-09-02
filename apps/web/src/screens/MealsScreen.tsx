import { MealWeek, type MealPlannerAdapter } from '@todolist/kitchen-ui';
import { useMemo } from 'react';
import { trpc } from '../lib/trpc';

/**
 * The web app's half of the meal planner: everything here is plumbing between
 * the shared `MealWeek` and this app's tRPC client. The Android app supplies the
 * same shape against on-device storage.
 */
export function MealsScreen() {
  const utils = trpc.useUtils();

  const adapter = useMemo<MealPlannerAdapter>(
    () => ({
      // `mine` then `ensure`: a member of someone else's plan gets that shared
      // plan rather than a second empty one of their own.
      ensurePlan: async () => {
        const mine = await utils.client.mealPlan.mine.query();
        if (mine[0]) return { id: mine[0].id, memberCount: mine[0].memberCount };
        const created = await utils.client.mealPlan.ensure.mutate();
        return { id: created.id, memberCount: 1 };
      },
      getWeek: (planId, from, to) => utils.client.mealPlan.range.query({ planId, from, to }),
      getMeals: (planId) => utils.client.mealPlan.meals.query({ planId }),
      setDay: async (input) => {
        await utils.client.mealPlan.setDay.mutate(input);
      },
      clearDay: async (planId, date) => {
        await utils.client.mealPlan.clearDay.mutate({ planId, date });
      },
      moveDay: async (planId, from, to) => {
        await utils.client.mealPlan.moveDay.mutate({ planId, from, to });
      },
      updateMeal: async (input) => {
        await utils.client.mealPlan.updateMeal.mutate(input);
      },
      toggleFavourite: async (id, isFavourite) => {
        await utils.client.mealPlan.toggleFavourite.mutate({ id, isFavourite });
      },
      sendToShoppingList: (planId, from, to) =>
        utils.client.mealPlan.sendToShoppingList.mutate({ planId, from, to }),
      invite: async (planId, email) => {
        await utils.client.mealPlan.invite.mutate({ planId, email });
      },
    }),
    [utils],
  );

  return (
    <MealWeek
      adapter={adapter}
      // The shopping push writes into a tRPC-backed list the shared component
      // knows nothing about, so this app refreshes those views itself.
      onSent={() => {
        utils.lists.mine.invalidate();
        utils.lists.shopping.invalidate();
        utils.tasks.agenda.invalidate();
      }}
    />
  );
}
