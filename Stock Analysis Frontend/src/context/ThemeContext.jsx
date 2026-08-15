import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const theme = 'dark';

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('axiomity-theme', 'dark');
    }, []);

    const toggleTheme = () => {};
    const setTheme = () => {};

    return (
        <ThemeContext.Provider value={{ theme: 'dark', isDark: true, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
