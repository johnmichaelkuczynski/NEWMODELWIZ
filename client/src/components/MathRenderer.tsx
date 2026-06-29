import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  className?: string;
}

export function MathRenderer({ content, className = "" }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !content) return;

    try {
      // Process the content to render both inline and display math
      let processedContent = content;

      // Handle display math ($$...$$)
      processedContent = processedContent.replace(
        /\$\$(.*?)\$\$/g,
        (match, mathContent) => {
          const placeholder = `DISPLAY_MATH_${Math.random().toString(36).substr(2, 9)}`;
          setTimeout(() => {
            const element = containerRef.current?.querySelector(`[data-math="${placeholder}"]`);
            if (element) {
              try {
                katex.render(mathContent.trim(), element as HTMLElement, {
                  displayMode: true,
                  throwOnError: false
                });
              } catch (error) {
                console.warn('KaTeX display math render error:', error);
                element.textContent = `$$${mathContent}$$`;
              }
            }
          }, 0);
          return `<div data-math="${placeholder}" class="math-display my-2"></div>`;
        }
      );

      // Handle inline math (\(...\))
      processedContent = processedContent.replace(
        /\\?\\\((.*?)\\?\\\)/g,
        (match, mathContent) => {
          const placeholder = `INLINE_MATH_${Math.random().toString(36).substr(2, 9)}`;
          setTimeout(() => {
            const element = containerRef.current?.querySelector(`[data-math="${placeholder}"]`);
            if (element) {
              try {
                katex.render(mathContent.trim(), element as HTMLElement, {
                  displayMode: false,
                  throwOnError: false
                });
              } catch (error) {
                console.warn('KaTeX inline math render error:', error);
                element.textContent = `\\(${mathContent}\\)`;
              }
            }
          }, 0);
          return `<span data-math="${placeholder}" class="math-inline"></span>`;
        }
      );

      // Handle alternative inline math ($...$)
      processedContent = processedContent.replace(
        /(?<!\$)\$([^$\n]+?)\$(?!\$)/g,
        (match, mathContent) => {
          const placeholder = `INLINE_MATH_${Math.random().toString(36).substr(2, 9)}`;
          setTimeout(() => {
            const element = containerRef.current?.querySelector(`[data-math="${placeholder}"]`);
            if (element) {
              try {
                katex.render(mathContent.trim(), element as HTMLElement, {
                  displayMode: false,
                  throwOnError: false
                });
              } catch (error) {
                console.warn('KaTeX inline math render error:', error);
                element.textContent = `$${mathContent}$`;
              }
            }
          }, 0);
          return `<span data-math="${placeholder}" class="math-inline"></span>`;
        }
      );

      // Convert line breaks to HTML
      processedContent = processedContent.replace(/\n/g, '<br>');

      containerRef.current.innerHTML = processedContent;
    } catch (error) {
      console.error('Math rendering error:', error);
      // Fallback to plain text
      if (containerRef.current) {
        containerRef.current.textContent = content;
      }
    }
  }, [content]);

  return (
    <div 
      ref={containerRef}
      className={`math-content ${className}`}
      style={{
        lineHeight: '1.6',
        fontSize: '16px',
        height: '100%',
        overflow: 'hidden'
      }}
    />
  );
}