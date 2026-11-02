import { createContext, useContext } from "react";

/**
 * The current page's title (shown in the toolbar). A settings group whose
 * title only repeats it hides its heading, so "Info" never appears twice.
 */
export const PageTitleContext = createContext<string | null>(null);
export const usePageTitle = () => useContext(PageTitleContext);
