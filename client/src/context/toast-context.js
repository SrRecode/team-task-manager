import { createContext } from 'react';

/**
 * Holds the short lived messages that confirm a successful action.
 *
 * The context provides `show(message)` and `dismiss(id)`. A toast is a
 * confirmation of something that already happened, so the messages are polite
 * and never replace the state of the page.
 */
export const ToastContext = createContext(null);
