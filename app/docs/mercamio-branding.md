# Mercamio Dashboard Visual Enhancements

## Brand Color Palette
- **Mercamio Blue (#1F4F9C):** Use as primary accents for action buttons, active states, and key metrics to reinforce brand recognition.
- **Mercamio Teal (#29B8A6):** Apply to success states (material seguro) and secondary CTAs to create a fresh, modern feel.
- **Mercamio Amber (#F5A623):** Reserve for alert states and warning badges, keeping them noticeable yet on-brand.
- **Mercamio Coral (#FF6B5A):** Use sparingly for crítico alerts, ensuring urgency without clashing with the main palette.
- **Neutral Slate (#1A1D2C) & Mist (#F4F6FB):** Combine dark typography with soft neutral backgrounds for clarity and depth.

## Component Styling Suggestions
### Status Summary Cards
- Introduce angled corner accents in Mercamio Blue and Teal to create distinct silhouettes.
- Layer subtle diagonal gradients (Blue → Teal) behind the metrics to add motion while keeping readability.
- Embed miniature radial progress rings in Amber/Coral to depict coverage health.

### Notifications Panel
- Elevate the popover into a right-side drawer with a vertical gradient header (Blue → Mist).
- Group materials by severity, using Amber chips for alert and Coral chips for crítico items, each with iconography tailored to severity.
- Add CTA buttons like “Crear pedido urgente” styled with Blue background and Teal hover glow.

### Orders Table
- Alternate row backgrounds with Mist and white, applying a left border indicator: Teal for seguros, Amber for alerta, Coral for crítico.
- Replace plain text statuses with pill badges using the brand colors and subtle drop shadows.
- Include requester avatars or initials framed with Blue borders to humanize the data.

### Microinteractions
- Animate the notification bell with a Teal pulse when new crítico alerts arrive; combine with Amber shimmer on hover.
- Transition card elevations using timing curves inspired by Mercamio’s energetic brand (fast-out, slow-in).
- Implement skeleton loaders with Mist backgrounds and Blue accents to keep the loading state on-brand.

## Imagery & Backgrounds
- Incorporate abstract geometric patterns inspired by warehouse layouts, using transparent overlays of Blue and Teal.
- For empty states, craft custom illustrations in Mist with Amber highlights, keeping the narrative tied to Mercamio’s operations.
- Apply a soft vignette in the dashboard hero section transitioning from Blue to Teal, framing key metrics.

## Accessibility Considerations
- Ensure contrast ratios remain AA compliant: pair Coral text on Mist backgrounds with sufficient weight.
- Provide high-contrast outlines (Blue) for focus states, and retain textual labels alongside color-coded indicators.
- Offer a monochrome mode that relies on icon shape and text so colorblind users can interpret status levels.