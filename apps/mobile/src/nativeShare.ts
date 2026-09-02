import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { SharePort } from './share';

/**
 * Getting things off the device, natively.
 *
 * A WebView blocks page-initiated downloads, so a file has to be written first
 * and then handed to the OS share sheet — which is better than a download
 * anyway, since it reaches Drive, email or a message thread directly.
 *
 * The file goes to `Cache` rather than `Data`: it exists only to be handed over,
 * and the system is free to reclaim it afterwards.
 */
export const nativeShare: SharePort = {
  saveFile: async (name, _mimeType, contents) => {
    const { uri } = await Filesystem.writeFile({
      path: name,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      data: contents,
    });
    await Share.share({
      title: 'Kitchen Board backup',
      // `url` is what carries a file; `text` would send the path as a string.
      url: uri,
      dialogTitle: 'Save or send your backup',
    });
  },
  shareText: async (title, text) => {
    await Share.share({ title, text, dialogTitle: title });
  },
  describe: { file: 'Ready to share.', text: 'Ready to share.' },
};
