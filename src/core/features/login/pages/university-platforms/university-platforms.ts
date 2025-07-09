import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CoreNavigator } from '@services/navigator';
import { CoreNetwork } from '@services/network';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreKeyboard } from '@singletons/keyboard';
import { CoreSharedModule } from '@/core/shared.module';
import { Translate } from '@singletons';
import { CoreSites } from '@services/sites';
import { CoreLoadings } from '@services/overlays/loadings';
import { CoreSiteCheckResponse } from '@services/sites';
import { CoreUniversityPlatformsService, UniversityPlatform } from '@features/login/services/university-platforms';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
    selector: 'page-core-login-university-platforms',
    templateUrl: 'university-platforms.html',
    styleUrls: ['university-platforms.scss', '../../login.scss'],
    standalone: true,
    imports: [
        CoreSharedModule,
        FormsModule,
        ReactiveFormsModule,
    ],
})
export default class CoreLoginUniversityPlatformsPage implements OnInit {

    platforms: UniversityPlatform[] = [];
    eveaasPlatforms: UniversityPlatform[] = [];
    posgradosPlatforms: UniversityPlatform[] = [];
    loading = true;
    showTabs = false;
    selectedTab: 'eveas' | 'posgrados' = 'eveas';
    customUrlForm!: FormGroup;
    
    // Control variable for custom URL section - set to false to hide it
    showCustomUrlSection = false; // Change to true if needed in the future

    constructor(
        private universityPlatformsService: CoreUniversityPlatformsService,
        private formBuilder: FormBuilder
    ) {}

    get currentPlatforms(): UniversityPlatform[] {
        if (!this.showTabs) {
            return this.platforms;
        }
        return this.selectedTab === 'eveas' ? this.eveaasPlatforms : this.posgradosPlatforms;
    }

    async ngOnInit(): Promise<void> {
        this.initCustomUrlForm();
        await this.checkRemoteAvailabilityAndLoadPlatforms();
    }

    private initCustomUrlForm(): void {
        this.customUrlForm = this.formBuilder.group({
            customUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+\.unae\.edu\.ec.*/)]]
        });
    }

    async connectToCustomUrl(): Promise<void> {
        if (!this.customUrlForm.valid) {
            CoreAlerts.showError('Por favor, ingresa una URL válida de UNAE (debe contener unae.edu.ec).');
            return;
        }

        CoreKeyboard.close();

        if (!CoreNetwork.isOnline()) {
            CoreAlerts.showError(Translate.instant('core.networkerrormsg'));
            return;
        }

        const customUrl = this.customUrlForm.value.customUrl;
        const modal = await CoreLoadings.show();

        try {
            const checkResult = await CoreSites.checkSite(customUrl, undefined, 'Custom URL Connection');
            await this.login(checkResult);
        } catch (error) {
            CoreAlerts.showError('No se pudo conectar con la URL proporcionada. Verifica que sea correcta y que esté disponible.');
        } finally {
            modal.dismiss();
        }
    }

    async checkRemoteAvailabilityAndLoadPlatforms(): Promise<void> {
        this.loading = true;
        
        try {
            // Check if remote endpoints are available
            const availability = await this.universityPlatformsService.checkRemotePlatformsAvailability();
            
            if (availability.eveas && availability.posgrados) {
                // Both endpoints available - show tabs
                this.showTabs = true;
                await this.loadPlatformsByTabs();
            } else {
                // Fallback to regular mode without tabs
                this.showTabs = false;
                await this.loadPlatforms();
            }
        } catch (error) {
            console.error('Error checking remote availability:', error);
            // Fallback to regular mode
            this.showTabs = false;
            await this.loadPlatforms();
        }
    }

    async loadPlatformsByTabs(): Promise<void> {
        try {
            // Load both types of platforms
            const [eveasPlatforms, posgradosPlatforms] = await Promise.all([
                this.universityPlatformsService.getPlatformsByType('eveas'),
                this.universityPlatformsService.getPlatformsByType('posgrados')
            ]);
            
            this.eveaasPlatforms = eveasPlatforms;
            this.posgradosPlatforms = posgradosPlatforms;
            
            console.log('✅ Loaded platforms by tabs:', {
                eveas: this.eveaasPlatforms.length,
                posgrados: this.posgradosPlatforms.length
            });
            
            // 🔍 DEBUG: Check if platforms have image field
            console.log('🔍 DEBUG EVEAS Platforms:', this.eveaasPlatforms);
            console.log('🔍 DEBUG POSGRADOS Platforms:', this.posgradosPlatforms);
            
            // Check each platform specifically
            this.eveaasPlatforms.forEach((platform, index) => {
                console.log(`🔍 EVEAS Platform ${index}:`, {
                    id: platform.id,
                    name: platform.name,
                    hasImage: !!platform.image,
                    image: platform.image,
                    icon: platform.icon
                });
            });
            
        } catch (error) {
            console.error('Error loading platforms by tabs:', error);
            CoreAlerts.showError('Error cargando las plataformas específicas.');
        } finally {
            this.loading = false;
        }
    }

    async loadPlatforms(): Promise<void> {
        try {
            this.platforms = await this.universityPlatformsService.getPlatforms();
            
            console.log('✅ Loaded platforms:', this.platforms.length);
            
            // 🔍 DEBUG: Check if platforms have image field
            console.log('🔍 DEBUG Platforms:', this.platforms);
            
            // Check each platform specifically
            this.platforms.forEach((platform, index) => {
                console.log(`🔍 Platform ${index}:`, {
                    id: platform.id,
                    name: platform.name,
                    hasImage: !!platform.image,
                    image: platform.image,
                    icon: platform.icon
                });
            });
            
        } catch (error) {
            console.error('Error loading platforms:', error);
            CoreAlerts.showError('Error cargando las plataformas. Usando datos predeterminados.');
        } finally {
            this.loading = false;
        }
    }

    async connectToPlatform(platform: UniversityPlatform): Promise<void> {
        CoreKeyboard.close();

        if (!CoreNetwork.isOnline()) {
            CoreAlerts.showError(Translate.instant('core.networkerrormsg'));
            return;
        }

        const modal = await CoreLoadings.show();

        try {
            const checkResult = await CoreSites.checkSite(platform.url, undefined, 'University Platform Selector');
            await this.login(checkResult);
        } catch (error) {
            CoreAlerts.showError(error);
        } finally {
            modal.dismiss();
        }
    }

    protected async login(siteCheck: CoreSiteCheckResponse): Promise<void> {
        try {
            await CoreSites.checkApplication(siteCheck.config);
            CoreNavigator.navigate('/login/credentials', {
                params: { siteCheck },
            });
        } catch {
            // Ignore errors.
        }
    }

    async refreshPlatforms(event?: any): Promise<void> {
        try {
            if (this.showTabs) {
                await this.loadPlatformsByTabs();
            } else {
                this.platforms = await this.universityPlatformsService.getPlatforms();
            }
        } catch (error) {
            console.error('Error refreshing platforms:', error);
        } finally {
            if (event) {
                event.target.complete();
            }
        }
    }

    onTabChange(): void {
        console.log(`🔄 Tab changed to: ${this.selectedTab}`);
        // Tab content will update automatically through currentPlatforms getter
    }

    trackByPlatform(index: number, platform: UniversityPlatform): string {
        return platform.id;
    }

    async contactSupport(): Promise<void> {
        const supportEmail = 'soporte@unae.edu.ec';
        const subject = 'Soporte - Aplicación Móvil UNAE';
        const body = 'Hola, necesito ayuda con la aplicación móvil de UNAE.\n\nDescribe tu problema aquí:\n';
        
        try {
            const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(mailtoUrl, '_system');
        } catch (error) {
            await CoreAlerts.show({
                header: 'Contactar Soporte',
                message: `Puedes contactarnos en:<br><br>
                         <strong>Email:</strong> ${supportEmail}<br>
                         <strong>Teléfono:</strong> 07-370-1200<br>
                         <strong>Sitio web:</strong> www.unae.edu.ec`,
                buttons: ['Cerrar']
            });
        }
    }

    goBack(): void {
        CoreNavigator.navigate('/login/site');
    }

    openSettings(): void {
        CoreNavigator.navigate('/settings');
    }

}
