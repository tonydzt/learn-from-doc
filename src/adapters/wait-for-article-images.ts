function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
  });
}

export async function waitForArticleImages(article: HTMLElement | null): Promise<void> {
  if (!article) return;

  const images = Array.from(article.querySelectorAll<HTMLImageElement>('img'));
  images.forEach((image) => {
    if (image.loading === 'lazy') image.loading = 'eager';
  });
  const pendingImages = images.filter((image) => !image.complete);
  if (pendingImages.length === 0) return;

  await Promise.race([
    Promise.all(pendingImages.map(waitForImage)),
    new Promise((resolve) => window.setTimeout(resolve, 5000)),
  ]);
}
