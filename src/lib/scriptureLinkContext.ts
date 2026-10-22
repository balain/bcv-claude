import { createContext } from 'react';
import type { ScriptureRef } from './scriptureLinks';

/** Opens a linked passage in the app; without a provider, links fall back to their Browse-mode href. */
export const ScriptureLinkContext = createContext<((ref: ScriptureRef) => void) | null>(null);
