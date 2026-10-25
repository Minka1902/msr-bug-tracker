export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadText = (text: string, filename: string, type = 'text/plain') =>
  downloadBlob(new Blob([text], { type }), filename);

export const downloadUrl = (url: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  link.click();
};
