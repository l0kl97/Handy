//! Glass effect for the main window (macOS).
//!
//! On macOS 26+ the window gets Apple's Liquid Glass material: an
//! `NSGlassEffectView` inserted behind the webview. Older macOS falls back to
//! the classic sidebar vibrancy material. Other platforms do nothing; the
//! frontend hides the toggle there.
//!
//! The window is created transparent on macOS (lib.rs), so with glass off the
//! CSS paints opaque layers and the window looks as before.

use tauri::WebviewWindow;

/// Identifier we give our glass view so it can be found and removed again.
#[cfg(target_os = "macos")]
const GLASS_VIEW_ID: &str = "handy.liquid-glass";

/// Turn the glass effect on or off for `window`. Safe to call repeatedly.
pub fn apply(window: &WebviewWindow, enabled: bool) {
    #[cfg(target_os = "macos")]
    {
        let win = window.clone();
        let result = window.run_on_main_thread(move || {
            let liquid = macos::set_liquid_glass(&win, enabled);
            // No Liquid Glass (pre-macOS 26): use vibrancy instead.
            let effects = if enabled && !liquid {
                Some(
                    tauri::window::EffectsBuilder::new()
                        .effect(tauri::window::Effect::Sidebar)
                        .state(tauri::window::EffectState::FollowsWindowActiveState)
                        .build(),
                )
            } else {
                None
            };
            if let Err(e) = win.set_effects(effects) {
                log::warn!("Failed to set window effects: {e}");
            }
            log::debug!("Glass effect: enabled={enabled}, liquid={liquid}");
        });
        if let Err(e) = result {
            log::warn!("Failed to schedule glass effect: {e}");
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, enabled);
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::GLASS_VIEW_ID;
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject};
    use objc2::{msg_send, ClassType};
    use objc2_app_kit::{
        NSAutoresizingMaskOptions, NSUserInterfaceItemIdentification, NSView, NSWindow,
        NSWindowOrderingMode,
    };
    use objc2_foundation::NSString;
    use tauri::WebviewWindow;

    /// Adds or removes the Liquid Glass view. Returns true when Liquid Glass
    /// is (now) active, false when it is unavailable or was turned off.
    /// Must run on the main thread.
    pub fn set_liquid_glass(window: &WebviewWindow, enabled: bool) -> bool {
        let Ok(ptr) = window.ns_window() else {
            return false;
        };
        // SAFETY: `ns_window` is the live NSWindow behind `window`, and this
        // runs on the main thread (scheduled via run_on_main_thread).
        let ns_window = unsafe { &*(ptr as *const NSWindow) };
        let Some(content) = ns_window.contentView() else {
            return false;
        };

        let identifier = NSString::from_str(GLASS_VIEW_ID);
        let existing = content.subviews().iter().find(|v| {
            v.identifier()
                .map(|id| id.isEqualToString(&identifier))
                .unwrap_or(false)
        });

        if !enabled {
            if let Some(view) = existing {
                view.removeFromSuperview();
            }
            return false;
        }
        if existing.is_some() {
            return true;
        }

        // NSGlassEffectView only exists on macOS 26+; look it up at runtime.
        let Some(class) = AnyClass::get(c"NSGlassEffectView") else {
            return false;
        };
        // SAFETY: isSubclassOfClass: is a plain NSObject class method.
        let is_view: bool = unsafe { msg_send![class, isSubclassOfClass: NSView::class()] };
        if !is_view {
            return false;
        }

        let frame = content.bounds();
        // SAFETY: NSGlassEffectView is an NSView subclass (checked above), so
        // alloc/initWithFrame: returns a retained NSView.
        let view: Retained<NSView> = unsafe {
            let obj: *mut AnyObject = msg_send![class, alloc];
            let obj: *mut AnyObject = msg_send![obj, initWithFrame: frame];
            match Retained::from_raw(obj.cast::<NSView>()) {
                Some(v) => v,
                None => return false,
            }
        };
        view.setIdentifier(Some(&identifier));
        view.setAutoresizingMask(
            NSAutoresizingMaskOptions::ViewWidthSizable
                | NSAutoresizingMaskOptions::ViewHeightSizable,
        );
        // Below every sibling, i.e. behind the webview.
        content.addSubview_positioned_relativeTo(&view, NSWindowOrderingMode::Below, None);
        true
    }
}
