import { type CanvasRenderingContext2D, createCanvas, loadImage } from 'canvas';

const fontFamily = 'Lucida Sans Unicode';

const fontSizes = {
  heading: 80,
  author: 40,
  authorTitle: 26,
};

const fontStyles = {
  heading: `900 ${fontSizes.heading}px  ${fontFamily}`,
  author: `700 ${fontSizes.author}px ${fontFamily}`,
  authorTitle: `500 ${fontSizes.authorTitle}px ${fontFamily}`,
};

const colors = {
  primary: '#ffd166',
  secondary: 'white',
  base: '#560bad',
};

const avatarSize = 80;
const avatarBorder = 5;
const logoW = 100;
const logoH = 80;
const space = 40;

// Create canvas and get its context
const canvas = createCanvas(1200, 630);
const ctx = canvas.getContext('2d');

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';

  let yPosition = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = `${line + words[n]} `;
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, yPosition);
      line = `${words[n]} `;
      yPosition += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, yPosition);
}

interface Options {
  title: string;
  avatarUrl: string;
  name: string;
  position: string;
}
export async function generateCover({ title, avatarUrl, name, position }: Options) {
  // Load images
  const logo = await loadImage('https://d2fltix0v2e0sb.cloudfront.net/dev-black.png');
  const avatar = await loadImage(avatarUrl);

  // Background
  ctx.fillStyle = colors.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Heading text
  ctx.fillStyle = colors.secondary;
  ctx.font = fontStyles.heading;
  wrapText(ctx, title, space, fontSizes.heading + space, canvas.width - space * 2, fontSizes.heading);

  // Avatar
  const avatarTop = canvas.height - avatarSize - avatarSize / 2;
  const avatarLeft = space;

  // Border around avatar
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.arc(avatarSize / 2 + avatarLeft, avatarSize / 2 + avatarTop, avatarSize / 2 + avatarBorder, 0, 2 * Math.PI);
  ctx.fill();
  ctx.closePath();

  // Clip image before draw
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarSize / 2 + avatarLeft, avatarSize / 2 + avatarTop, avatarSize / 2, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.clip();

  // Put avatar
  ctx.drawImage(avatar, avatarLeft, avatarTop, avatarSize, avatarSize);

  // Unclip all around avatar
  ctx.beginPath();
  ctx.arc(0, 0, avatarSize / 2, 0, Math.PI * 2, true);
  ctx.clip();
  ctx.closePath();
  ctx.restore();

  // Author name
  ctx.fillStyle = colors.secondary;
  ctx.font = fontStyles.author;
  ctx.fillText(name, avatarLeft + avatarSize + space / 2, avatarTop + fontSizes.author - 4);

  // Author title
  ctx.fillStyle = colors.primary;
  ctx.font = fontStyles.authorTitle;
  ctx.fillText(position, avatarLeft + avatarSize + space / 2, avatarTop + fontSizes.author + fontSizes.authorTitle);

  // Add logo
  ctx.drawImage(logo, canvas.width - logoH - 60, canvas.height - logoH - logoH / 2 + space / 4, logoW, logoH);

  // Return PNG Stream
  // you can pass pngConfig here
  return canvas.createPNGStream();
}

export function nodeStreamToWebStream(nodeReadableStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeReadableStream.on('data', (chunk) => {
        controller.enqueue(chunk);
      });

      nodeReadableStream.on('end', () => {
        controller.close();
      });

      nodeReadableStream.on('error', (err) => {
        controller.error(err);
      });
    },
  });
}
