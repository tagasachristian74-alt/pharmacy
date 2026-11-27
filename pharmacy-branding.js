"use strict";

(function (global) {
    const STORAGE_KEY = "epharmaSettings";
    const SESSION_KEY = "epharmaSession";
    const DEMO_USERS_KEY = "epharmaDemoUsers";
    const DEFAULT_LOGO_PATH = "assets/default-logo.svg";

    const DEFAULT_DEMO_USERS = []; // No offline authentication accounts.

    const DEFAULT_SETTINGS = {
        pharmacyName: "E-Pharma",
        pharmacyEmail: "epharma@example.com",
        pharmacyPhone: "09123456789",
        addressStreet: "",
        addressBarangay: "",
        addressCity: "",
        addressProvince: "",
        addressPostalCode: "",
        addressCountry: "Philippines",
        addressLandmark: "",
        pharmacyAddress: "Philippines",
        pharmacyLogo: "",
        adminName: "Admin",
        adminEmail: "admin@example.com",
        cashierName: "Cashier",
        dateFormat: "MM/DD/YYYY",
        lowStockLevel: 10
    };

    function getDemoUsers() {
        try {
            const raw = localStorage.getItem(DEMO_USERS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch {
            // Ignore storage errors.
        }
        return DEFAULT_DEMO_USERS.map(u => ({ ...u }));
    }

    function saveDemoUsers(users) {
        try {
            localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
        } catch {
            // Ignore storage errors.
        }
    }

    function getActiveSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.role === "admin" || parsed.role === "cashier")) {
                    return {
                        user_id: parsed.user_id || (parsed.role === "cashier" ? 2 : 1),
                        username: String(parsed.username || parsed.role),
                        fullName: String(parsed.fullName || (parsed.role === "cashier" ? "Cashier" : "Administrator")),
                        email: String(parsed.email || ""),
                        avatar: String(parsed.avatar || ""),
                        employee_id: String(parsed.employee_id || ""),
                        status: String(parsed.status || "Active"),
                        role: parsed.role
                    };
                }
            }
        } catch {
            // Ignore parse errors.
        }
        return {
            user_id: 1,
            username: "admin",
            fullName: "Administrator",
            email: "admin@example.com",
            role: "admin"
        };
    }

    function setActiveSession(session) {
        const role = session && session.role === "cashier" ? "cashier" : "admin";
        const clean = {
            user_id: (session && session.user_id) || (role === "cashier" ? 2 : 1),
            username: String((session && session.username) || role),
            fullName: String((session && (session.fullName || session.full_name)) || (role === "cashier" ? "Cashier" : "Administrator")),
            email: String((session && session.email) || ""),
            avatar: String((session && session.avatar) || ""),
            employee_id: String((session && session.employee_id) || ""),
            status: String((session && session.status) || "Active"),
            role
        };
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(clean));
            localStorage.setItem(SESSION_KEY, JSON.stringify(clean));
        } catch {
            // Ignore storage errors.
        }
        return clean;
    }

    function clearActiveSession() {
        try {
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_KEY);
        } catch {
            // Ignore storage errors.
        }
    }

    function formatAddress(settings) {
        const s = settings || {};
        const street = String(s.addressStreet || "").trim();
        const barangay = String(s.addressBarangay || "").trim();
        const city = String(s.addressCity || "").trim();
        const province = String(s.addressProvince || "").trim();
        const postal = String(s.addressPostalCode || "").trim();
        const country = String(s.addressCountry || "").trim();
        const landmark = String(s.addressLandmark || "").trim();

        const cityProvincePostal = [
            city,
            province && postal ? `${province} ${postal}` : province || postal
        ]
            .filter(Boolean)
            .join(", ");

        const mainParts = [street, barangay, cityProvincePostal, country].filter(Boolean);
        let full = mainParts.join(", ");

        if (landmark) {
            full = full ? `${full} (${landmark})` : landmark;
        }

        return full || String(s.pharmacyAddress || "").trim() || "Philippines";
    }

    function normalizeLegacyFields(raw) {
        if (!raw || typeof raw !== "object") {
            return {};
        }

        const normalized = { ...raw };

        if (raw.settingPharmacyName !== undefined && raw.pharmacyName === undefined) {
            normalized.pharmacyName = raw.settingPharmacyName;
        }
        if (raw.settingPharmacyEmail !== undefined && raw.pharmacyEmail === undefined) {
            normalized.pharmacyEmail = raw.settingPharmacyEmail;
        }
        if (raw.settingPharmacyPhone !== undefined && raw.pharmacyPhone === undefined) {
            normalized.pharmacyPhone = raw.settingPharmacyPhone;
        }
        if (raw.settingPharmacyAddress !== undefined && raw.pharmacyAddress === undefined) {
            normalized.pharmacyAddress = raw.settingPharmacyAddress;
        }
        if (raw.settingAdminName !== undefined && raw.adminName === undefined) {
            normalized.adminName = raw.settingAdminName;
        }
        if (raw.settingAdminEmail !== undefined && raw.adminEmail === undefined) {
            normalized.adminEmail = raw.settingAdminEmail;
        }
        if (raw.settingDateFormat !== undefined && raw.dateFormat === undefined) {
            normalized.dateFormat = raw.settingDateFormat;
        }
        if (raw.settingLowStock !== undefined && raw.lowStockLevel === undefined) {
            normalized.lowStockLevel = Number(raw.settingLowStock) || DEFAULT_SETTINGS.lowStockLevel;
        }

        return normalized;
    }

    function normalizeSettings(raw) {
        const cleaned = normalizeLegacyFields(raw);
        const merged = {
            ...DEFAULT_SETTINGS,
            ...cleaned
        };

        merged.pharmacyName = String(merged.pharmacyName || "").trim() || DEFAULT_SETTINGS.pharmacyName;
        merged.pharmacyEmail = String(merged.pharmacyEmail || "").trim();
        merged.pharmacyPhone = String(merged.pharmacyPhone || "").trim();
        merged.addressStreet = String(merged.addressStreet || "").trim();
        merged.addressBarangay = String(merged.addressBarangay || "").trim();
        merged.addressCity = String(merged.addressCity || "").trim();
        merged.addressProvince = String(merged.addressProvince || "").trim();
        merged.addressPostalCode = String(merged.addressPostalCode || "").trim();
        merged.addressCountry = String(merged.addressCountry || "").trim();
        merged.addressLandmark = String(merged.addressLandmark || "").trim();
        merged.pharmacyAddress = formatAddress(merged);

        if (!merged.pharmacyLogo || merged.pharmacyLogo === DEFAULT_LOGO_PATH) {
            merged.pharmacyLogo = "";
        }

        merged.adminName = String(merged.adminName || "").trim() || DEFAULT_SETTINGS.adminName;
        merged.adminEmail = String(merged.adminEmail || "").trim();
        merged.cashierName = String(merged.cashierName || "").trim() || DEFAULT_SETTINGS.cashierName;
        merged.dateFormat = String(merged.dateFormat || DEFAULT_SETTINGS.dateFormat);

        const lowStock = Number(merged.lowStockLevel);
        merged.lowStockLevel = Number.isInteger(lowStock) && lowStock >= 1
            ? lowStock
            : DEFAULT_SETTINGS.lowStockLevel;

        return merged;
    }

    function hasLocalCache() {
        try {
            return Boolean(localStorage.getItem(STORAGE_KEY));
        } catch {
            return false;
        }
    }

    function getCachedSettings() {
        try {
            const localRaw = localStorage.getItem(STORAGE_KEY);
            if (localRaw) {
                return normalizeSettings(JSON.parse(localRaw));
            }

            const sessionRaw = sessionStorage.getItem(STORAGE_KEY);
            if (sessionRaw) {
                return normalizeSettings(JSON.parse(sessionRaw));
            }
        } catch (error) {
            console.warn("Could not read cached pharmacy settings.", error);
        }

        return { ...DEFAULT_SETTINGS };
    }

    function cacheSettings(settings) {
        const normalized = normalizeSettings(settings);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.warn("Could not save settings to localStorage.", error);
        }

        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch {
            // Ignore sessionStorage errors.
        }

        return normalized;
    }

    function getLogoSrc(settings) {
        return settings && settings.pharmacyLogo
            ? settings.pharmacyLogo
            : DEFAULT_LOGO_PATH;
    }

    function hasSpecificAddress(settings) {
        if (!settings) return false;
        return Boolean(
            String(settings.addressStreet || "").trim() ||
            String(settings.addressBarangay || "").trim() ||
            String(settings.addressCity || "").trim() ||
            String(settings.addressProvince || "").trim() ||
            String(settings.addressPostalCode || "").trim() ||
            String(settings.addressLandmark || "").trim()
        );
    }

    function updateFavicon(logoSrc) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }
        link.href = logoSrc;
    }

    function applyLogoToElement(imgEl, wrapEl, logoSrc, hasCustom, pharmacyName) {
        if (imgEl) {
            imgEl.src = logoSrc;
            imgEl.alt = `${pharmacyName} Logo`;
        }
        if (wrapEl) {
            wrapEl.classList.toggle("has-custom-logo", hasCustom);
        }
    }

    function applyBranding(rawSettings) {
        const settings = normalizeSettings(rawSettings || getCachedSettings());
        const name = settings.pharmacyName;
        const logoSrc = getLogoSrc(settings);
        const hasCustom = Boolean(settings.pharmacyLogo);
        const fullAddress = formatAddress(settings);
        const hasDetailedAddress = hasSpecificAddress(settings);

        // Update browser tab title and icon.
        const isLoginPage = Boolean(document.getElementById("loginForm"));
        document.title = isLoginPage
            ? `${name} | Login`
            : `${name} | Pharmacy Management System`;
        updateFavicon(logoSrc);

        // Keep the receipt logo in sync if the sales page is open.
        applyLogoToElement(document.getElementById("receiptPharmacyLogo"), null, logoSrc, hasCustom, name);

        // Dashboard sidebar brand.
        applyLogoToElement(
            document.getElementById("sidebarBrandLogo"),
            document.getElementById("sidebarBrandLogoWrap"),
            logoSrc,
            hasCustom,
            name
        );

        const sidebarBrandName = document.getElementById("sidebarBrandName");
        if (sidebarBrandName) {
            sidebarBrandName.textContent = name;
        }

        // Dashboard footer.
        const footerName = document.getElementById("footerPharmacyName");
        if (footerName) {
            footerName.textContent = `${name} Pharmacy Management System`;
        }

        const footerAddress = document.getElementById("footerPharmacyAddress");
        if (footerAddress) {
            footerAddress.textContent = hasDetailedAddress
                ? `${fullAddress} · 2026`
                : "Pharmacy Management · 2026";
        }

        // Dashboard active user profile & role labels.
        const session = getActiveSession();
        const isCashier = session.role === "cashier";
        const displayName = session.fullName
            || (isCashier ? (settings.cashierName || "Cashier") : (settings.adminName || "Administrator"));
        const roleSubtitle = isCashier ? "POS Cashier" : "Administrator";
        const userInitial = displayName.charAt(0).toUpperCase() || (isCashier ? "C" : "A");

        if (document.body && !isLoginPage) {
            document.body.dataset.userRole = session.role;
        }

        const sidebarAdminName = document.getElementById("sidebarAdminName");
        if (sidebarAdminName) {
            sidebarAdminName.textContent = displayName;
        }

        const sidebarRoleLabel = document.getElementById("sidebarRoleLabel");
        if (sidebarRoleLabel) {
            sidebarRoleLabel.textContent = isCashier
                ? `Cashier (${session.username})`
                : `Admin (${session.username})`;
        }

        const topbarAdminName = document.getElementById("topbarAdminName");
        if (topbarAdminName) {
            topbarAdminName.textContent = displayName;
        }

        const topbarRoleLabel = document.getElementById("topbarRoleLabel");
        if (topbarRoleLabel) {
            topbarRoleLabel.textContent = roleSubtitle;
        }

        const topbarRoleBadge = document.getElementById("topbarRoleBadge");
        if (topbarRoleBadge) {
            topbarRoleBadge.textContent = isCashier ? "Cashier" : "Admin";
            topbarRoleBadge.classList.toggle("role-badge--cashier", isCashier);
            topbarRoleBadge.classList.toggle("role-badge--admin", !isCashier);
        }

        ["sidebarAdminAvatar", "topbarAdminAvatar"].forEach(function (id) {
            const avatar = document.getElementById(id);
            if (!avatar) return;
            avatar.textContent = userInitial;
            const image = document.createElement("img");
            image.alt = "";
            image.onerror = function () { image.remove(); };
            image.src = session.avatar || (isCashier ? "assets/avatar-cashier.png" : "assets/avatar-admin.png");
            avatar.appendChild(image);
        });

        // Login page desktop & mobile branding.
        applyLogoToElement(
            document.getElementById("loginBrandLogo"),
            document.getElementById("loginBrandLogoWrap"),
            logoSrc,
            hasCustom,
            name
        );

        const loginBrandName = document.getElementById("loginBrandName");
        if (loginBrandName) {
            loginBrandName.textContent = name;
        }

        applyLogoToElement(
            document.getElementById("mobileBrandLogo"),
            document.getElementById("mobileBrandLogoWrap"),
            logoSrc,
            hasCustom,
            name
        );

        const mobileBrandName = document.getElementById("mobileBrandName");
        if (mobileBrandName) {
            mobileBrandName.textContent = name;
        }

        const loginBrandAddress = document.getElementById("loginBrandAddress");
        if (loginBrandAddress) {
            if (hasDetailedAddress) {
                loginBrandAddress.textContent = `📍 ${fullAddress}`;
                loginBrandAddress.hidden = false;
            } else {
                loginBrandAddress.textContent = "";
                loginBrandAddress.hidden = true;
            }
        }

        const loginCopyright = document.getElementById("loginCopyright");
        if (loginCopyright) {
            loginCopyright.textContent = `© 2026 ${name}. All rights reserved.`;
        }

        return settings;
    }

    async function syncFromServer() {
        try {
            const response = await fetch("/api/settings");
            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            if (!data || !data.settings) {
                return null;
            }

            if (data.configured || !hasLocalCache()) {
                const saved = cacheSettings(data.settings);
                applyBranding(saved);
                return saved;
            }
        } catch {
            // Keep cached settings when running without backend API.
        }

        return null;
    }

    async function saveSettings(partial) {
        const current = getCachedSettings();
        const merged = normalizeSettings({
            ...current,
            ...partial
        });

        const cached = cacheSettings(merged);
        applyBranding(cached);

        let syncedToServer = false;

        try {
            const response = await fetch("/api/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(cached)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || "Unable to save settings on the server.");
            }
            if (response.ok) {
                const data = await response.json();
                if (data && data.settings) {
                    const serverSaved = cacheSettings(data.settings);
                    applyBranding(serverSaved);
                    syncedToServer = true;
                    return { settings: serverSaved, syncedToServer: true, warning: data.warning || null };
                }
            }
        } catch (error) {
            if (!(error instanceof TypeError)) {
                cacheSettings(current);
                applyBranding(current);
                throw error;
            }
            // Network unavailable: the browser cache is the only copy.
        }

        return { settings: cached, syncedToServer };
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Could not read image file."));
            reader.readAsDataURL(file);
        });
    }

    async function processLogoFile(file) {
        if (!file) {
            throw new Error("No image file selected.");
        }

        if (!file.type || !file.type.startsWith("image/")) {
            throw new Error("Please select a valid image file (PNG, JPG, WebP, GIF, or SVG).");
        }

        if (file.size > 5 * 1024 * 1024) {
            throw new Error("Logo image must be smaller than 5 MB.");
        }

        const dataUrl = await readFileAsDataUrl(file);

        // Preserve SVG and GIF exactly (including animation). Raster images are resized.
        if (file.type === "image/svg+xml") {
            const decoded = atob(dataUrl.split(",")[1] || "");
            if (/<script[\s>]|on\w+\s*=|javascript:/i.test(decoded)) throw new Error("Unsupported SVG content.");
            return dataUrl;
        }
        if (file.type === "image/gif") return dataUrl;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            throw new Error("Please select a PNG, JPG, WebP, GIF, or SVG image.");
        }
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onerror = () => reject(new Error("Could not decode the image."));
            image.onload = () => {
                try {
                    let width = image.naturalWidth || image.width;
                    let height = image.naturalHeight || image.height;
                    if (!width || !height) throw new Error("Invalid image dimensions.");
                    const scale = Math.min(1, 400 / width, 400 / height);
                    width = Math.max(1, Math.round(width * scale));
                    height = Math.max(1, Math.round(height * scale));
                    const canvas = document.createElement("canvas");
                    const limit = 150 * 1024;
                    for (let attempt = 0; attempt < 8; attempt++) {
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) throw new Error("Image compression is not supported in this browser.");
                        ctx.drawImage(image, 0, 0, width, height);
                        // Unsupported WebP encoders typically return PNG; both preserve transparency.
                        for (const quality of [0.85, 0.7, 0.5, 0.35]) {
                            const result = canvas.toDataURL("image/webp", quality);
                            if (result.length < limit) return resolve(result);
                        }
                        width = Math.max(1, Math.floor(width * 0.75));
                        height = Math.max(1, Math.floor(height * 0.75));
                    }
                    reject(new Error("Unable to compress this logo below 150 KB; try another image."));
                } catch (error) { reject(error); }
            };
            image.src = dataUrl;
        });
    }

    async function processAvatarFile(file) {
        if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPG or WebP photo.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Photo must be smaller than 5 MB.");
        const dataUrl = await readFileAsDataUrl(file);
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onerror = () => reject(new Error("Could not decode the photo."));
            image.onload = () => {
                try {
                    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
                    if (!width || !height) throw new Error("Invalid photo dimensions.");
                    const side = Math.min(width, height);
                    const canvas = document.createElement("canvas");
                    for (let size = 256; size >= 48; size = Math.floor(size * 0.75)) {
                        canvas.width = size; canvas.height = size;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) throw new Error("Photo compression is not supported.");
                        ctx.drawImage(image, (width-side)/2, (height-side)/2, side, side, 0, 0, size, size);
                        for (const quality of [0.85, 0.7, 0.5, 0.35]) {
                            const result = canvas.toDataURL("image/webp", quality);
                            if (result.length <= 136500 && /^data:image\/(webp|png);base64,/.test(result)) return resolve(result);
                        }
                    }
                    reject(new Error("Unable to compress this photo below 100 KB."));
                } catch (error) { reject(error); }
            };
            image.src = dataUrl;
        });
    }

    global.EPharmaBranding = {
        DEFAULT_LOGO_PATH,
        DEFAULT_SETTINGS,
        DEFAULT_DEMO_USERS,
        formatAddress,
        hasSpecificAddress,
        getLogoSrc,
        getCachedSettings,
        cacheSettings,
        applyBranding,
        syncFromServer,
        saveSettings,
        processLogoFile,
        processAvatarFile,
        getDemoUsers,
        saveDemoUsers,
        getActiveSession,
        setActiveSession,
        clearActiveSession
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            applyBranding(getCachedSettings());
            syncFromServer();
        });
    } else {
        applyBranding(getCachedSettings());
        syncFromServer();
    }

    global.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY) {
            applyBranding(getCachedSettings());
        }
    });
})(window);
