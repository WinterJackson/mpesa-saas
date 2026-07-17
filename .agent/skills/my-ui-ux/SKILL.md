---
name: my-ui-ux
description: Mandatory architectural reference and implementation guide for all UI/UX implementations across the Vepo platform (Customer, Vendor, and Rider apps).
---

# Vepo Platform UI/UX Standardization Skill

This skill enforces strict, pixel-perfect design uniformity across all three applications in the Vepo ecosystem (Customer App, Vendor App, Rider App). The **Customer App** is the authoritative canonical reference. Any deviation from these rules in the Vendor or Rider apps is considered a bug and must be refactored.

---

## 1. Core Brand Colors (The Source of Truth)
Never use hardcoded hex values in styles. Always import and use the `BRAND` and `TOAST` objects from `constants/brandColors.ts`, or use the custom Tailwind tokens configured in `tailwind.config.js`.

```typescript
import { BRAND, TOAST } from '@/constants/brandColors';

// Allowed BRAND tokens:
BRAND.primary       // #216FE6 (Vepo Blue)
BRAND.primaryDark   // #154a99
BRAND.primaryLight  // #d9e6fc
BRAND.background    // #F6F8FA
BRAND.darkBg        // #09090b
BRAND.gray900 - BRAND.gray50 // Full gray scale
BRAND.white         // #ffffff
BRAND.black         // #000000
```

---

## 2. Dynamic Theming & Tailwind Tokens
Every UI component must support dynamic theming.
- **Hook:** Always consume `UIThemeContext`.
```tsx
import { useContext } from 'react';
import { UIThemeContext } from '@/context/ThemeContext';

const { currentTheme } = useContext(UIThemeContext);
const darkTheme = currentTheme === 'dark';
```

### Tailwind Custom Tokens (Must Use)
The platform uses strict semantic tokens from `tailwind.config.js`. Do not use arbitrary values.
- **Colors (Dark Mode Context):** `bg-surface`, `bg-surface-dim`, `bg-surface-bright`, `bg-surface-container`, `text-on-surface`, `text-on-surface-variant`, `border-outline`, `border-outline-variant`.
- **Spacing Scale:** `xs` (4px), `sm` (8px), `md` (16px), `lg` (24px), `xl` (32px), `gutter` (16px), `margin` (20px).

---

## 3. Platform Navigation Patterns

### 3.1 Bottom Tab Navigation (Floating Navbar)
The platform uses a floating bottom navigation bar that is absolute-positioned.
- **Mandatory Clearance:** Every scrollable view (`ScrollView`, `FlashList`) MUST have a minimum `paddingBottom` of `120px` to prevent content from being hidden behind the floating navbar.
- **Active Tab Tinting:** Active tab icons must be tinted `white` regardless of whether the app is in light or dark mode.

### 3.2 Standard Screen Headers (Home & Sub-pages)
All standard screens (including the Home screen in `index.tsx` and sub-pages like Settings) MUST feature a consistent header with a 1px border and a subtle shadow.

**Mandatory Header Structure:**
```tsx
<View style={{ overflow: "hidden", paddingBottom: 4 }}>
    <View 
        className="flex-row items-center px-4 py-3 pb-4 mb-2"
        style={{ 
            backgroundColor: darkTheme ? "#000" : "#fff",
            borderBottomWidth: 1, 
            borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
            shadowColor: darkTheme ? "#000" : BRAND.gray800,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3
        }}
    >
        <PressableScale onPress={() => router.back()}>
            <BackButtonMinimal />
        </PressableScale>
        <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
            Page Title
        </Text>
    </View>
</View>
```
*Exception*: Headers that have images or maps underneath should be strictly styled exactly as they are in the Customer App without the solid background and bottom border.

### 3.3 Navigation Animations
Navigation animations should strictly emulate the Customer App:
- Tab navigation transitions should `fade`.
- Standard page pushes should `slide_from_right`.
- Modal screens should `slide_from_bottom`.

### 3.4 Android Navigation Bar
You must configure the Android navigation bar dynamically to match the app theme using `expo-navigation-bar`:
```typescript
import * as NavigationBar from 'expo-navigation-bar';
NavigationBar.setButtonStyleAsync(darkTheme ? 'light' : 'dark');
```

---

## 4. Mandatory Components

### 4.1 PressableScale (Interactive Elements)
Do not use raw `TouchableOpacity` or `Pressable`. ALL interactive elements must use `PressableScale` for consistent haptic and spring-based scale feedback.
- **Spring Params:** `mass: 1`, `damping: 15`, `stiffness: 300`.
```tsx
<PressableScale activeOpacity={0.7} onPress={handlePress}>
    <View>...</View>
</PressableScale>
```

### 4.2 Standard Buttons (`VepoButton` & `Button`)
- **Primary CTA (`VepoButton`):** Use for all main actions. Supports `title`, `onPress`, `style`, `textStyle`, `disabled`.
- **Secondary/Outline (`Button`):** General purpose button. Use `type="outline"` for secondary actions. Supports `label`, `iconleft`, `iconright`.

### 4.3 GlassCard
Use `GlassCard` for elevated, rounded card containers.
- **Spec:** Uses `rounded-[32px] p-6 shadow-md` with `bg-surface-container border border-outline-variant/20` in dark mode.

### 4.4 BackButtonMinimal vs BackButton
Both exist in the codebase, but you must **exclusively use `BackButtonMinimal`** for standard screen navigation. `BackButton` is deprecated for general use.

### 4.5 Image Caching
Always use `expo-image` (not `react-native` Image) for network images.
- **Mandatory Props:** `cachePolicy="disk"` and `transition={200}`.

### 4.6 List Rendering (FlashList)
Always use `@shopify/flash-list` (`FlashList`) instead of `FlatList` for all scrollable lists to ensure 60fps performance.

### 4.7 BottomSheet Pattern
The app uses `@gorhom/bottom-sheet`. Ensure the entire app is wrapped in `BottomSheetModalProvider` in `_layout.tsx` to allow global sheet usage.

### 4.8 Safe Area Management
Always wrap root screens in `SafeAreaView` from `react-native-safe-area-context`. Use `const insets = useSafeAreaInsets()` to dynamically add padding for floating elements (e.g., `paddingBottom: 120 + insets.bottom`).

---

## 5. UI Layout Patterns

### 5.1 Settings Item Pattern
For settings and profile pages, adhere to the standard `SettingItem` pattern:
```tsx
<TouchableOpacity 
    activeOpacity={0.7} 
    onPress={onPress}
    className={`flex-row items-center justify-between py-4 border-b ${darkTheme ? "border-gray-800" : "border-gray-200"}`}
>
    <View className="flex-row items-center gap-4">
        <View className={`w-10 h-10 items-center justify-center rounded-full ${darkTheme ? "bg-gray-800" : "bg-gray-100"}`}>
            <Ionicons name={iconName} size={20} color={darkTheme ? "#ffffff" : "#000000"} />
        </View>
        <Text className={`text-lg font-semibold ${darkTheme ? "text-white" : "text-gray-900"}`}>
            {title}
        </Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={darkTheme ? "white" : "black"} />
</TouchableOpacity>
```

### 5.2 Dark Mode Toggle Switch
Implement toggle switches exactly as seen in `SettingsMain.tsx`:
```tsx
<View className={`w-12 h-6 rounded-full justify-center px-1 ${darkTheme ? "bg-primary" : "bg-gray-300"}`}>
    <View className={`w-4 h-4 rounded-full bg-white shadow-sm ${darkTheme ? "self-end" : "self-start"}`} />
</View>
```

---

## 6. Alerts, Notifications, and Feedback

### 6.1 Toast (Non-blocking Alerts)
Never use `Alert.alert()`. Use the singleton `Toast` system for success/error feedback.
```typescript
import { Toast } from '@/lib/toast';
Toast.success("Success", "Action completed");
```

### 6.2 Popup (Blocking Modals/Confirmations)
For confirmations (e.g., logout, delete), use the `Popup` singleton.
```typescript
import { Popup } from '@/lib/popup';
Popup.show({
    title: "Delete Account",
    message: "Are you sure?",
    confirmText: "Delete",
    isDestructive: true,
    onConfirm: () => executeDelete(),
});
```

### 6.3 EmptyState, DropyScene & ErrorState
Use `EmptyState` for empty lists and `ErrorState` (which wraps `DropyScene`) for error boundaries.
- **Valid Moods Only:** `"proud"`, `"concerned"`, `"sad"`, `"celebrate"`, `"search"`
- **ErrorState Prop Spec:**
```tsx
import { ErrorState } from '@/components/ui/ErrorState';
<ErrorState message="Network error." onRetry={refetch} />
```

### 6.4 OfflineBanner
The app utilizes an `OfflineBanner` component located in `components/ui/OfflineBanner.tsx` using `@react-native-community/netinfo`. This must be placed in the root `_layout.tsx` to globally monitor and display network connectivity issues.

---

## 7. Skeletons (Loading States)
Never use full-page `ActivityIndicator` for loading content. Always use Contextual Skeletons from `components/skeletons/ContextualSkeletons.tsx`.
- Skeletons MUST accurately match the exact dimensions, border radius, and layout of the actual rendered component to prevent layout shifts.
- **Contextual Skeleton Inventory:**
  - `NotificationItemSkeleton`
  - `VendorCardSkeleton`
  - `ProductCardSkeleton`
  - `BentoCategorySkeleton`
  - `CartItemSkeleton`
  - `AddressItemSkeleton`
  - `OrderCardSkeleton`

---

## 8. Network & Caching (React Query)
- **Caching Config:** `staleTime: 1000 * 60 * 5` (5 mins), `gcTime: 1000 * 60 * 15` (15 mins), `networkMode: 'offlineFirst'`.
- **Cache clearing:** Upon user sign-out, you MUST clear all React Query caches to prevent data leakage (`queryClient.clear()`).

---

## 9. Typography & Fonts
The platform strictly uses the **Inter** font family (`Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`, `Inter-Bold`). Never use default system fonts for highly branded UI text.

---

## 10. Map Implementations
All map views must enforce strict light/dark map styles based on the active theme, exactly as done in the Customer App.
- **Dark Mode:** Use `MAP_DARK_STYLE`
- **Light Mode:** Use `MAP_RETRO_STYLE` (do not use default standard light style).

---

## 11. Iconography
ONLY use `@expo/vector-icons/Ionicons`. Do not mix FontAwesome, MaterialIcons, or other libraries. This ensures complete uniformity in icon weight and style across the 3 apps.

---

## Pre-Implementation Checklist
Before merging any UI changes, verify:
- [ ] Are hardcoded colors completely eliminated in favor of `BRAND` tokens or Tailwind semantic tokens?
- [ ] Does the UI react properly to the `UIThemeContext` (Light/Dark mode)?
- [ ] Are all touchables wrapped in `PressableScale`?
- [ ] Does the scrollable area have `paddingBottom: 120` to clear the navbar?
- [ ] Are native `Alert.alert()` calls replaced with `Toast` or `Popup`?
- [ ] Is `expo-image` used with `cachePolicy="disk"` instead of native Image?
- [ ] Is `FlashList` used instead of `FlatList`?
- [ ] Does the screen header match the standardized bottom-border/shadow styling?
- [ ] Are contextual skeletons used instead of spinners for initial load?
- [ ] Are all icons exclusively `Ionicons`?

## Common Violations
- ❌ Hardcoding `#ffffff` instead of using `BRAND.white` or Tailwind `bg-white` classes.
- ❌ Using `ActivityIndicator` in the center of the screen while fetching data.
- ❌ Forgetting `paddingBottom: 120` on a list, obscuring the last items behind the floating navbar.
- ❌ Using `Image` from `react-native` instead of `expo-image`.
- ❌ Using `Alert.alert` for error handling.
- ❌ Using inconsistent shadow or border radiuses (use standard Tailwind `rounded-2xl`, `rounded-3xl`, `rounded-full`, or `GlassCard`).
