import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@todolist/api/router';

export const trpc = createTRPCReact<AppRouter>();
