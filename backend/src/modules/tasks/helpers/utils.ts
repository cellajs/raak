import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { parse as parseHtml } from 'node-html-parser';

export const extractKeywords = (description: string) => {
  const descriptionElement = parseHtml(description);
  const descriptionText = descriptionElement.textContent || '';

  const words = descriptionText
    .split(/\s+/) // Split by any whitespace
    .map((word) => word.toLowerCase()) // Convert to lowercase
    .map((word) => word.replace(/[^a-z0-9]/g, '')) // Remove non-alphanumeric chars
    .filter((word) => word.length > 0); // Filter out empty strings

  const uniqueWords = [...new Set(words)];

  return uniqueWords.join(' ');
};

export const getDateFromToday = (days: number): Date => {
  // Calculate the date 'days' ago from today
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - days);
  return targetDate;
};

export const scanTaskDescription = (descriptionText: string) => {
  const window = new JSDOM('').window;
  const DOMPurify = createDOMPurify(window);

  //Sanitizing task description
  const cleanDescription = DOMPurify.sanitize(descriptionText);

  const keywords = extractKeywords(cleanDescription);

  const rootElement = parseHtml(cleanDescription);
  const paragraphElement = rootElement.querySelector('.bn-inline-content');

  let summary = cleanDescription;
  let expandable = false;

  if (paragraphElement) {
    paragraphElement.classList.add('inline');
    summary = paragraphElement.toString();
    const bnBlockElements = rootElement.querySelectorAll('.bn-block-outer');
    expandable = bnBlockElements.length > 1;
  }

  return { description: cleanDescription, summary, expandable, keywords };
};
