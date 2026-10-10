import { removeBackground } from '@imgly/background-removal';

self.onmessage = async ({ data: file }) => {
  try {
    const image = await removeBackground(file, {
      model: 'isnet_fp16',
      device: 'cpu',
      output: { format: 'image/png', type: 'foreground' },
      progress: (key, current, total) => self.postMessage({ type: 'progress', key, current, total }),
    });
    self.postMessage({ type: 'complete', image });
  } catch {
    self.postMessage({ type: 'error' });
  }
};
