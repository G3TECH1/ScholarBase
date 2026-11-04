# ScholarBase Marketing Frontend

Public-facing website for **ScholarBase**, the cloud school management platform developed by **G3Tech IT Group**. The site introduces the platform, explains its core workflows, presents plan information, and gives schools a way to request a product walkthrough.

Built with semantic HTML, Bootstrap 5, custom CSS, and lightweight vanilla JavaScript. It is a static multi-page frontend: no build step or package installation is required.

## Pages

| Page | File | Purpose |
| --- | --- | --- |
| Home | `index.html` | Product introduction, key capabilities, audience outcomes, pricing preview, and demo calls to action. |
| Features | `features.html` | Details on academic results, fee administration, role-based portals, and cloud access. |
| Pricing | `pricing.html` | Starter, Standard, and Enterprise plan information. |
| About G3Tech | `about.html` | The engineering group and the thinking behind ScholarBase. |
| Contact | `contact.html` | Demo enquiry form, direct support contact, and school portal guidance. |

All pages share the same navigation, visual system, and footer. Navigation and calls to action link to the relevant page instead of relying on a single long landing page.

## Features

- Responsive layouts for mobile phones, tablets, laptops, and desktop screens.
- Bootstrap 5 grid, responsive navigation, and components, loaded from a CDN.
- Custom design system in `css/style.css`, including responsive rules, focus states, transitions, and reduced-motion support.
- Vanilla JavaScript in `js/main.js` for active-page navigation, reveal-on-scroll effects, the dynamic copyright year, and the contact form handoff.
- Local `.avif` photography and dashboard imagery in `images/`.
- Bootstrap Icons and DM Sans / Manrope typography, loaded externally.

## Project Structure

```text
Saas-Marketing-Frontend/
├── index.html
├── features.html
├── pricing.html
├── about.html
├── contact.html
├── css/
│   └── style.css
├── js/
│   └── main.js
└── images/
    ├── browser-body.avif
    ├── learning.avif
    ├── photo-1531482615713-2afd69097998.avif
    └── teamwork.avif
```

## Run Locally

### Option 1: VS Code Live Server

Open this folder in VS Code, install or enable **Live Server**, then right-click `index.html` and choose **Open with Live Server**.

### Option 2: Python's static server

From this directory, run:

```bash
python -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000). If your system uses the `py` launcher, `py -m http.server 8000` works as well.

You can open `index.html` directly in a browser for a quick preview, but a local server more closely matches a deployed site.

## Contact Form Behavior

The form in `contact.html` validates the required fields in the browser, then prepares an email using the visitor's default mail application. It is **not** connected to a form service or backend, so the visitor must send the prepared email to complete the enquiry.

The recipient is configured on the form element using `data-contact-email`. Update that value in `contact.html` if the support address changes. To accept enquiries without requiring a visitor's email application, connect the form to a trusted server endpoint or form-processing provider and update `js/main.js` accordingly.

The School Login link currently directs users to portal guidance. A school-specific authenticated portal requires a real login URL and authentication service.

## Content and Launch Checks

Before publishing, confirm the following with the product and support teams:

- Plan prices, billing terms, included features, and any applicable taxes.
- Claims about uptime, backups, encryption, security certifications, and support availability.
- The active support email and school portal destinations.
- That all local image files and external CDN resources load in the target hosting environment.
- Privacy, cookie, accessibility, and terms pages required for the intended audience and jurisdiction.

The pricing and capability descriptions on a marketing page should be treated as publishable product claims and verified before launch.

## Updating the Site

- Edit the relevant HTML page to change page content or navigation.
- Update `css/style.css` for shared typography, colors, layout, and responsive behavior.
- Update `js/main.js` for shared interactions. Keep the page usable when JavaScript is unavailable where practical.
- Keep image paths relative to the project root (for example, `images/learning.avif`) so the site works when hosted in a subdirectory.
- When adding a page, add it to the navigation and footer links on the other pages, and include the shared stylesheet and script.

## Technology

HTML5 · CSS · Bootstrap 5 · Bootstrap Icons · Vanilla JavaScript