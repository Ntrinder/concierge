const svg = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" } as const;

export const CloseIcon = () => <svg {...svg}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const SendIcon = () => <svg {...svg}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const BackIcon = () => <svg {...svg}><path d="M15 6l-6 6 6 6" /></svg>;
export const CheckIcon = () => <svg {...svg}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const FlagIcon = () => <svg {...svg} width={16} height={16}><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>;
export const ChatIcon = () => <svg {...svg}><path d="M4 5h16v11H9l-5 4z" /></svg>;
