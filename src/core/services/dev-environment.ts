// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable } from '@angular/core';
import { CorePlatform } from '@services/platform';
import { CoreUrl } from '@singletons/url';

/**
 * Service to handle development environment specific fixes.
 */
@Injectable({ providedIn: 'root' })
export class CoreDevEnvironmentService {

    /**
     * Check if the app is running in development mode.
     * @returns Whether the app is in development mode
     */
    isDevelopment(): boolean {
        return !CorePlatform.isMobile() && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    }

    /**
     * Rewrite URL for development proxy to avoid CORS issues.
     * @param url Original URL
     * @returns Proxied URL for development
     */
    rewriteUrlForProxy(url: string): string {
        if (!this.isDevelopment()) {
            return url;
        }

        try {
            const parsedUrl = new URL(url);
            
            // Check if it's a Moodle AJAX or webservice endpoint
            if (parsedUrl.pathname.includes('/lib/ajax/') || parsedUrl.pathname.includes('/webservice/')) {
                // For development, route through our proxy
                const proxyPath = parsedUrl.pathname + parsedUrl.search;
                return `${window.location.origin}${proxyPath}`;
            }
        } catch (error) {
            // Invalid URL, return as is
            console.warn('CoreDevEnvironment: Invalid URL for proxy rewrite:', url);
        }

        return url;
    }

    /**
     * Add CORS headers for development mode.
     * @returns Headers object for development
     */
    getDevelopmentHeaders(): Record<string, string> {
        if (!this.isDevelopment()) {
            return {};
        }

        return {
            'X-Requested-With': 'XMLHttpRequest',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        };
    }
}
