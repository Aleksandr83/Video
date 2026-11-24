<template>
    <!-- Drawn from primitives on purpose: a hand-crafted path can look wrong at 20 px and only a
         rendered screenshot shows it. Shapes are filled with currentColor so the caller decides the
         color, and the icon carries no text: its name is supplied by the button that uses it. -->
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <rect x="9.4" y="2.6" width="5.2" height="2.2" rx="1.1" fill="currentColor" />
        <rect x="3.6" y="5.4" width="16.8" height="2.4" rx="1.2" fill="currentColor" />
        <path d="M6.6 9.4h10.8l-.85 10.1a1.7 1.7 0 0 1-1.7 1.5H9.15a1.7 1.7 0 0 1-1.7-1.5L6.6 9.4Z" fill="currentColor" />
        <rect x="10.1" y="11.8" width="1.4" height="6.4" rx="0.7" fill="currentColor" />
        <rect x="12.9" y="11.8" width="1.4" height="6.4" rx="0.7" fill="currentColor" />
    </svg>
</template>
