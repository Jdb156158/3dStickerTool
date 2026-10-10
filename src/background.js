let worker;

export function backgroundProgress(key, current, total) {
  if (key.startsWith('fetch:')) {
    const percent = total > 0 ? Math.min(100, Math.round(current / total * 100)) : 0;
    return `正在下载本地模型资源：${percent}%（首次较慢，图片不会上传）`;
  }
  return key === 'compute:encode' ? '正在导出透明主体…' : '正在本机识别主体与毛发边缘…';
}

export function removeSubjectBackground(file, onProgress) {
  worker ||= new Worker(new URL('./background-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const fail = () => {
      worker.terminate(); worker = null;
      reject(new Error('本地 AI 抠图未完成。请检查模型下载网络，或尝试缩小图片后重试。未上传图片，也未退回纯色抠图。'));
    };
    worker.onerror = fail;
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress(backgroundProgress(data.key, data.current, data.total));
      else if (data.type === 'complete') resolve(data.image);
      else fail();
    };
    worker.postMessage(file);
  });
}
