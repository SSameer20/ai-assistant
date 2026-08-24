import { BrowserWindow } from "electron";

export interface NavigationEvent {
  route: string;
  timestamp: string;
  userId?: string;
}

export class NavigationService {
  private mainWindow: BrowserWindow | null;
  private allowedRoutes: Set<string>;

  constructor(
    mainWindow: BrowserWindow | null,
    allowedRoutes: string[] = ["/", "/settings", "/login", "/onboarding", "/dashboard"],
  ) {
    this.mainWindow = mainWindow;
    this.allowedRoutes = new Set(allowedRoutes);
  }

  /**
   * Navigate to a route if valid
   */
  public navigate(route: string, userId?: string): boolean {
    if (!this.isRouteAllowed(route)) {
      this.sendNavigationError(`Route not allowed: ${route}`);
      return false;
    }
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.sendNavigationError("Main window not available");
      return false;
    }
    this.mainWindow.webContents.send("nav:change", route);
    this.logNavigation({ route, timestamp: new Date().toISOString(), userId });
    return true;
  }

  /**
   * Validate if a route is allowed
   */
  public isRouteAllowed(route: string): boolean {
    // Simple validation: must be in allowedRoutes
    return this.allowedRoutes.has(route);
  }

  /**
   * Add a new allowed route
   */
  public addAllowedRoute(route: string): void {
    this.allowedRoutes.add(route);
  }

  /**
   * Remove an allowed route
   */
  public removeAllowedRoute(route: string): void {
    this.allowedRoutes.delete(route);
  }

  /**
   * Log navigation event (could be extended to use a logger)
   */
  private logNavigation(event: NavigationEvent): void {
    // For now, just log to console. Replace with real logger if needed.
    console.log("Navigation event:", event);
  }

  /**
   * Send navigation error to renderer (could be extended)
   */
  private sendNavigationError(message: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("nav:error", message);
    }
    console.error("NavigationService error:", message);
  }

  /**
   * Set the main window reference (for hot reload or window recreation)
   */
  public setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }
}
