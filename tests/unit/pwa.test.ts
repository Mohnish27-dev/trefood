import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dismissInstallPrompt,
  isIOSDevice,
  isStandaloneMode,
  openInstallPrompt,
  pwaInitScript,
} from "@/components/shared/pwa";

describe("pwaInitScript", () => {
  it("captures beforeinstallprompt and dispatches custom events", () => {
    expect(pwaInitScript).toContain("__trefoodInstallPrompt");
    expect(pwaInitScript).toContain("beforeinstallprompt");
    expect(pwaInitScript).toContain("trefood:pwa-prompt-ready");
    expect(pwaInitScript).toContain("appinstalled");
    expect(pwaInitScript).toContain("trefood:pwa-installed");
  });
});

describe("isStandaloneMode", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      navigator: {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false in normal browser view", () => {
    expect(isStandaloneMode()).toBe(false);
  });

  it("returns true when display-mode: standalone matches", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(display-mode: standalone)",
      })),
      navigator: {},
    });
    expect(isStandaloneMode()).toBe(true);
  });

  it("returns true when navigator.standalone is true (iOS standalone)", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      navigator: { standalone: true },
    });
    expect(isStandaloneMode()).toBe(true);
  });
});

describe("isIOSDevice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("identifies iPhone userAgent as iOS", () => {
    vi.stubGlobal("window", {
      navigator: {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        platform: "iPhone",
        maxTouchPoints: 5,
      },
    });
    expect(isIOSDevice()).toBe(true);
  });

  it("identifies iPad userAgent as iOS", () => {
    vi.stubGlobal("window", {
      navigator: {
        userAgent: "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15",
        platform: "iPad",
        maxTouchPoints: 5,
      },
    });
    expect(isIOSDevice()).toBe(true);
  });

  it("identifies iPadOS reporting as MacIntel with touch as iOS", () => {
    vi.stubGlobal("window", {
      navigator: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      },
    });
    expect(isIOSDevice()).toBe(true);
  });

  it("returns false for Android userAgent", () => {
    vi.stubGlobal("window", {
      navigator: {
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
      },
    });
    expect(isIOSDevice()).toBe(false);
  });

  it("returns false for Windows desktop userAgent", () => {
    vi.stubGlobal("window", {
      navigator: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        platform: "Win32",
        maxTouchPoints: 0,
      },
    });
    expect(isIOSDevice()).toBe(false);
  });
});

describe("install prompt state toggling", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      localStorage: {
        removeItem: vi.fn(),
      },
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dismisses and opens cleanly without throwing", () => {
    expect(() => dismissInstallPrompt()).not.toThrow();
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      "trefood.install.dismissed.session",
      "1",
    );

    expect(() => openInstallPrompt()).not.toThrow();
    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith(
      "trefood.install.dismissed.session",
    );
  });
});
