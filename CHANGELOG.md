# Changelog

## v1.0.2 — 2026-02-14

### Emergency Protocols — Full Implementation

All five emergency protocols are now fully functional with unified framework, persistent state, socket sync, and player-facing alerts.

**Self-Destruct**
- Active countdown displayed on player STATUS screen
- GM dialog to select who armed the self-destruct
- STATUS nav button flashes red until player clicks it
- Alarm sound plays on activation
- Computer voice warning every real minute via Web Speech API
- Log event auto-created on arm and cancel

**Evacuation Protocol**
- Persistent warning on player STATUS screen
- STATUS nav button flashes red
- Alarm sound on activation
- GM dialog to select who triggered evacuation
- Log event auto-created

**Ship Lockdown**
- Amber-themed overlay on player STATUS screen indicating all doors locked
- GM dialog to set who triggered lockdown
- Log event auto-created

**Distress Signal**
- Broadcasting status shown on player STATUS screen
- GM dialog to set who triggered the signal
- Log event auto-created

**Atmosphere Purge**
- Deck-by-deck selection for Cronus (Deck A/B/C/D) or entire ship
- Montero defaults to entire ship (single deck)
- Persistent warning on player STATUS screen
- GM dialog to set who triggered the purge
- Log event auto-created

**Emergency Cancel**
- GM can cancel any active emergency from STATUS or EMERGENCY views
- Cancel correctly dismisses player alerts using authoritative server state (fixed race condition where socket ordering caused stale local state)
- Log event auto-created on cancel

### Command Codes — Relocated to CMD CODE View

- Moved command code management out of Settings/GM Controls into the CMD CODE view
- GM terminal shows MASTER_OVERRIDE banner (no keypad needed) plus code management UI (add, remove, save codes with auto-generated 8-digit codes)
- Player terminal keeps numeric keypad for code entry

### MU/TH/UR Terminal — Command Code Integration

- Players can now enter 8-digit command codes directly in the MU/TH/UR chat
- Invalid codes return ACCESS DENIED with buzz sound
- Valid codes below CORPORATE clearance return INSUFFICIENT CLEARANCE
- Valid CORPORATE or MASTER_OVERRIDE codes elevate clearance and respond with ACCESS GRANTED
- After code acceptance, the previous query is automatically resubmitted so the player gets their answer without retyping
- AI conversation history is reset on clearance elevation to prevent stale denial patterns

### MU/TH/UR Terminal — Clearance-Gated Classified Data

- Replaced hardcoded override code in Cronus AI prompt with clearance-level checks
- AI now reads ACTIVE CLEARANCE LEVEL from live telemetry data
- CORPORATE or MASTER_OVERRIDE clearance grants immediate access to classified Cronus mission intel without prompting for a code
- GM terminal always injects MASTER_OVERRIDE into AI context
- Lower clearance levels get "ACCESS RESTRICTED. WEYLAND CORPORATION EYES ONLY. ENTER COMMAND CODE."

### MU/TH/UR Terminal — Visual

- User-typed text and input field changed from cyan to green to match terminal theme
- Prompt character was already green (no change needed)

### Cargo Manifest

- Removed category filter buttons from both GM and player terminals — all cargo items now display by default
- Removed color-coded category badges (blue, red, yellow, etc.) — all TYPE badges now use uniform terminal green
- Removed related CSS (filter bar, filter buttons, per-category color classes) and JS (filter click handlers, category data generation)

### Systems View

- Fixed ADD SYSTEM button width to match SAVE CONFIGURATION button

### Bug Fixes

- Fixed emergency cancel race condition where player alert wouldn't dismiss because the emergencyCancelled socket arrived before statusUpdate, leaving local state stale. GM now includes authoritative anyRemaining flag in the cancel payload.
- Fixed MU/TH/UR engine not recognizing GM as MASTER_OVERRIDE clearance when building live ship context (was reading raw world setting which only stored player clearance)
- Added resetConversation() to MuthurEngine to clear cached conversation turns and summaries when clearance level changes

### Internal

- Module version bumped to 1.0.2
- Added static EMERGENCY_PROTOCOLS config object mapping protocol keys to labels, socket types, log messages, and alert text
- Added unified emergency helper methods: _activateEmergency(), _cancelEmergency(), _showEmergencyTriggerDialog(), _showAtmospherePurgeDialog()
- Added _flashStatusButton() for red nav button pulse animation
- Added _tryCommandCodeInMuthur() for code validation in chat
- Added _lastMuthurQuery tracking for auto-resubmit after code entry
- Added CSS keyframes: wy-eo-pulse, wy-eo-pulse-amber, navRedFlash
- Added emergency overlay CSS classes: wy-emergency-overlay, wy-emergency-self-destruct, wy-emergency-lockdown, wy-emergency-active-box
