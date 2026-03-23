import { useEffect, useState } from "react";

/**
 * Hook to detect and propagate backend connectivity errors.
 * Checks sessionStorage for backend error messages set by axios interceptor.
 */
export function useBackendError() {
    const [backendError, setBackendError] = useState<string | null>(null);

    useEffect(() => {
        const checkBackendError = () => {
            const error = sessionStorage.getItem("backendError");
            if (error) {
                setBackendError(error);
                // Clear after displaying once
                sessionStorage.removeItem("backendError");
            }
        };

        // Check on mount
        checkBackendError();

        // Check periodically (every 2s) in case new errors occur
        const interval = setInterval(checkBackendError, 2000);

        return () => clearInterval(interval);
    }, []);

    return backendError;
}
