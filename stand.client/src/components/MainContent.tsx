import { useEffect, useRef } from 'react';
import { Box, type BoxProps } from '@mui/material';
import { useLocation } from 'react-router-dom';

// Wait for asynchronously loaded headings before announcing a new page or step.
export default function MainContent({ focusKey, ...props }: BoxProps & { focusKey?: string }) {
    const ref = useRef<HTMLElement>(null);
    const { pathname } = useLocation();

    useEffect(() => {
        const main = ref.current;
        if (!main) return;
        const announce = () => {
            const heading = main.querySelector('h1');
            if (!heading) return false;
            document.title = `${heading.textContent} — Стенди`;
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
            window.scrollTo(0, 0);
            return true;
        };
        if (announce()) return;
        const observer = new MutationObserver(() => { if (announce()) observer.disconnect(); });
        observer.observe(main, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [pathname, focusKey]);

    return <Box {...props} ref={ref} component="main" id="main-content" tabIndex={-1} />;
}
