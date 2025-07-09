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
import { CoreNetwork } from '@services/network';
import { CoreUtils } from '@singletons/utils';

export interface UniversityPlatform {
    id: string;
    name: string;
    url: string;
    description: string;
    icon: string;
    color: string;
    image?: string; // Optional image URL from webservice
}

/**
 * Service to manage university platforms.
 */
@Injectable({
    providedIn: 'root',
})
export class CoreUniversityPlatformsService {

    // URLs del webservice de Minio UNAE
    protected readonly WEBSERVICE_EVEAS_URL = 'https://minio.unae.edu.ec/public/config/app-eveas-main.json';
    protected readonly WEBSERVICE_POSGRADOS_URL = 'https://minio.unae.edu.ec/public/config/app-eveas-posgrados.json';

    /**
     * Get university platforms from webservice or fallback to local JSON.
     * 
     * @returns Promise resolved with array of platforms.
     */
    async getPlatforms(): Promise<UniversityPlatform[]> {
        console.log('🔍 CoreUniversityPlatformsService: Getting platforms...');
        
        // Try to get platforms from webservice first
        if (CoreNetwork.isOnline()) {
            console.log('🌐 Network is online, trying webservice...');
            try {
                const platforms = await this.getPlatformsFromWebservice('eveas');
                if (platforms && platforms.length > 0) {
                    console.log('✅ Successfully loaded platforms from webservice:', platforms.length);
                    await this.cachePlatforms(platforms);
                    return platforms;
                }
            } catch (error) {
                console.warn('❌ Failed to load platforms from webservice:', error);
                // Fall back to local JSON if webservice fails
            }
        } else {
            console.log('📴 Network is offline, using local fallback...');
        }

        // Fallback to local JSON file
        console.log('📁 Loading platforms from local file...');
        const localPlatforms = await this.getPlatformsFromLocal();
        console.log('✅ Successfully loaded platforms from local file:', localPlatforms.length);
        return localPlatforms;
    }

    /**
     * Get university platforms by type (eveas or posgrados).
     * 
     * @param type Type of platforms to get ('eveas' or 'posgrados').
     * @returns Promise resolved with array of platforms.
     */
    async getPlatformsByType(type: 'eveas' | 'posgrados'): Promise<UniversityPlatform[]> {
        console.log(`🔍 CoreUniversityPlatformsService: Getting ${type} platforms...`);
        
        // Try to get platforms from webservice first
        if (CoreNetwork.isOnline()) {
            console.log('🌐 Network is online, trying webservice...');
            try {
                const platforms = await this.getPlatformsFromWebservice(type);
                if (platforms && platforms.length > 0) {
                    console.log(`✅ Successfully loaded ${type} platforms from webservice:`, platforms.length);
                    await this.cachePlatformsByType(platforms, type);
                    return platforms;
                }
            } catch (error) {
                console.warn(`❌ Failed to load ${type} platforms from webservice:`, error);
                // Fall back to local JSON if webservice fails
            }
        } else {
            console.log('📴 Network is offline, using local fallback...');
        }

        // Fallback to cached or local data
        const cachedPlatforms = this.getCachedPlatformsByType(type);
        if (cachedPlatforms) {
            console.log(`📦 Using cached ${type} platforms:`, cachedPlatforms.length);
            return cachedPlatforms;
        }

        // If it's eveas, fallback to local JSON
        if (type === 'eveas') {
            console.log('📁 Loading eveas platforms from local file...');
            const localPlatforms = await this.getPlatformsFromLocal();
            console.log('✅ Successfully loaded eveas platforms from local file:', localPlatforms.length);
            return localPlatforms;
        }

        // For posgrados, return empty array if no data available
        console.log('⚠️ No posgrados platforms available, returning empty array');
        return [];
    }

    /**
     * Get platforms from webservice.
     * 
     * @param type Type of platforms ('eveas' or 'posgrados').
     * @returns Promise resolved with platforms from webservice.
     */
    protected async getPlatformsFromWebservice(type: 'eveas' | 'posgrados'): Promise<UniversityPlatform[]> {
        const url = type === 'eveas' ? this.WEBSERVICE_EVEAS_URL : this.WEBSERVICE_POSGRADOS_URL;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                cache: 'no-cache',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Validate response data
            if (!Array.isArray(data)) {
                throw new Error('Invalid response format: expected array');
            }

            // Transform webservice response to our format if needed
            return data.map(platform => this.validateAndTransformPlatform(platform));
        } catch (error) {
            console.error(`Error fetching ${type} platforms from webservice:`, error);
            throw error;
        }
    }

    /**
     * Get platforms from local JSON file.
     * 
     * @returns Promise resolved with platforms from local file.
     */
    protected async getPlatformsFromLocal(): Promise<UniversityPlatform[]> {
        try {
            const response = await fetch('assets/data/app-eveas-fallback.json');
            const platforms = await response.json();
            
            if (!Array.isArray(platforms)) {
                throw new Error('Invalid local JSON format: expected array');
            }

            return platforms.map(platform => this.validateAndTransformPlatform(platform));
        } catch (error) {
            console.error('Error loading local platforms:', error);
            
            // Final fallback - hardcoded platforms
            return this.getFallbackPlatforms();
        }
    }

    /**
     * Validate and transform platform data.
     * 
     * @param platform Raw platform data.
     * @returns Validated platform object.
     */
    protected validateAndTransformPlatform(platform: any): UniversityPlatform {
        console.log('🔍 Transforming platform data:', platform);
        
        const transformedPlatform = {
            id: platform.id || CoreUtils.getUniqueId('platform'),
            name: platform.name || platform.nombre || 'Plataforma',
            url: platform.url || platform.enlace || '',
            description: platform.description || platform.descripcion || '',
            icon: platform.icon || platform.icono || 'school-outline',
            color: platform.color || 'primary',
            image: platform.image || platform.imagen || undefined, // Add image field support
        };
        
        console.log('✅ Transformed platform:', transformedPlatform);
        return transformedPlatform;
    }

    /**
     * Get fallback platforms when all other methods fail.
     * 
     * @returns Array of fallback platforms.
     */
    protected getFallbackPlatforms(): UniversityPlatform[] {
        return [
            {
                id: 'pregrado',
                name: 'Pregrado Presencial',
                url: 'https://pregrado.unae.edu.ec',
                description: 'Carreras de pregrado modalidad presencial',
                icon: 'school-outline',
                color: 'primary'
            },
            {
                id: 'linea',
                name: 'Pregrado en Línea',
                url: 'https://pregradoenlinea.unae.edu.ec',
                description: 'Carreras de pregrado modalidad virtual',
                icon: 'laptop-outline',
                color: 'secondary'
            },
            {
                id: 'distancia',
                name: 'Distancia Profesionalización',
                url: 'https://distancia.unae.edu.ec',
                description: 'Programas de profesionalización docente a distancia',
                icon: 'map-outline',
                color: 'tertiary'
            },
            {
                id: 'educon',
                name: 'Educación Continua',
                url: 'https://educacioncontinua.unae.edu.ec/',
                description: 'Cursos y programas de formación continua',
                icon: 'refresh-outline',
                color: 'success'
            },
            {
                id: 'curext',
                name: 'Cursos Extracurriculares',
                url: 'https://cursosextracurriculares.unae.edu.ec/',
                description: 'Talleres y cursos complementarios',
                icon: 'extension-puzzle-outline',
                color: 'warning'
            }
        ];
    }

    /**
     * Cache platforms for offline use.
     * 
     * @param platforms Platforms to cache.
     */
    async cachePlatforms(platforms: UniversityPlatform[]): Promise<void> {
        try {
            const cached = {
                platforms,
                timestamp: Date.now(),
            };
            localStorage.setItem('university_platforms_cache', JSON.stringify(cached));
        } catch (error) {
            console.warn('Failed to cache platforms:', error);
        }
    }

    /**
     * Cache platforms by type for offline use.
     * 
     * @param platforms Platforms to cache.
     * @param type Type of platforms ('eveas' or 'posgrados').
     */
    async cachePlatformsByType(platforms: UniversityPlatform[], type: 'eveas' | 'posgrados'): Promise<void> {
        try {
            const cached = {
                platforms,
                timestamp: Date.now(),
            };
            localStorage.setItem(`university_platforms_cache_${type}`, JSON.stringify(cached));
        } catch (error) {
            console.warn(`Failed to cache ${type} platforms:`, error);
        }
    }

    /**
     * Get cached platforms.
     * 
     * @param maxAge Maximum age in milliseconds (default: 1 hour).
     * @returns Cached platforms or null if not available/expired.
     */
    getCachedPlatforms(maxAge: number = 3600000): UniversityPlatform[] | null {
        try {
            const cached = localStorage.getItem('university_platforms_cache');
            if (!cached) {
                return null;
            }

            const data = JSON.parse(cached);
            const isExpired = (Date.now() - data.timestamp) > maxAge;
            
            if (isExpired) {
                localStorage.removeItem('university_platforms_cache');
                return null;
            }

            return data.platforms;
        } catch (error) {
            console.warn('Failed to get cached platforms:', error);
            return null;
        }
    }

    /**
     * Get cached platforms by type.
     * 
     * @param type Type of platforms ('eveas' or 'posgrados').
     * @param maxAge Maximum age in milliseconds (default: 1 hour).
     * @returns Cached platforms or null if not available/expired.
     */
    getCachedPlatformsByType(type: 'eveas' | 'posgrados', maxAge: number = 3600000): UniversityPlatform[] | null {
        try {
            const cached = localStorage.getItem(`university_platforms_cache_${type}`);
            if (!cached) {
                return null;
            }

            const data = JSON.parse(cached);
            const isExpired = (Date.now() - data.timestamp) > maxAge;
            
            if (isExpired) {
                localStorage.removeItem(`university_platforms_cache_${type}`);
                return null;
            }

            return data.platforms;
        } catch (error) {
            console.warn(`Failed to get cached ${type} platforms:`, error);
            return null;
        }
    }

    /**
     * Clear cached platforms.
     */
    clearCache(): void {
        try {
            localStorage.removeItem('university_platforms_cache');
            localStorage.removeItem('university_platforms_cache_eveas');
            localStorage.removeItem('university_platforms_cache_posgrados');
        } catch (error) {
            console.warn('Failed to clear platforms cache:', error);
        }
    }

    /**
     * Check if remote platforms are available for both eveas and posgrados.
     * 
     * @returns Promise resolved with availability status.
     */
    async checkRemotePlatformsAvailability(): Promise<{ eveas: boolean; posgrados: boolean }> {
        const result = { eveas: false, posgrados: false };

        if (!CoreNetwork.isOnline()) {
            return result;
        }

        // Check eveas endpoint
        try {
            const eveaaResponse = await fetch(this.WEBSERVICE_EVEAS_URL, { method: 'HEAD' });
            result.eveas = eveaaResponse.ok;
        } catch (error) {
            console.warn('Eveas endpoint not available:', error);
        }

        // Check posgrados endpoint
        try {
            const posgradosResponse = await fetch(this.WEBSERVICE_POSGRADOS_URL, { method: 'HEAD' });
            result.posgrados = posgradosResponse.ok;
        } catch (error) {
            console.warn('Posgrados endpoint not available:', error);
        }

        return result;
    }
}
