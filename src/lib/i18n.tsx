"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Lang = "de" | "en";

const translations: Record<string, { de: string; en: string }> = {
  // Portal Navigation
  "portalNav.dashboard": { de: "Dashboard", en: "Dashboard" },
  "portalNav.scripts": { de: "Skripte", en: "Scripts" },
  "portalNav.strategy": { de: "Strategie", en: "Strategy" },
  "portalNav.ideas": { de: "Ideen", en: "Ideas" },
  "portalNav.audit": { de: "Audit", en: "Audit" },
  "portalNav.videos": { de: "Videos", en: "Videos" },
  "portalNav.chat": { de: "Chat", en: "Chat" },
  "portalNav.voice": { de: "Voice", en: "Voice" },
  "portalNav.logout": { de: "Abmelden", en: "Log out" },
  "portal.loading": { de: "Laden...", en: "Loading..." },

  // Navigation & Sidebar
  "nav.strategy": { de: "Strategie", en: "Strategy" },
  "nav.new": { de: "Neu", en: "New" },
  "nav.noClients": { de: "Noch keine Clients", en: "No clients yet" },
  "nav.selectClient": { de: "Wähle einen Client aus", en: "Select a client" },
  "nav.tools": { de: "Tools", en: "Tools" },
  "nav.clients": { de: "Clients", en: "Clients" },
  "nav.context": { de: "Kontext", en: "Context" },
  "nav.posts": { de: "Posts", en: "Posts" },
  "nav.videos": { de: "Videos", en: "Videos" },
  "nav.creators": { de: "Creators", en: "Creators" },
  "nav.training": { de: "Training", en: "Training" },
  "nav.transcribe": { de: "Transkribieren", en: "Transcribe" },
  "nav.viralityChecklist": { de: "Virality Checklist", en: "Virality Checklist" },

  // New Client Dialog
  "newClient.title": { de: "Neuer Client", en: "New Client" },
  "newClient.subtitle": { de: "Gib die Links an — die KI füllt das Profil automatisch aus.", en: "Provide the links — AI will fill in the profile automatically." },
  "newClient.namePlaceholder": { de: "Max Mustermann", en: "John Doe" },
  "newClient.igPlaceholder": { de: "@handle oder instagram.com/...", en: "@handle or instagram.com/..." },
  "newClient.linkHint": { de: "Mindestens einen Link angeben damit die KI das Profil automatisch ausfüllen kann.", en: "Add at least one link so AI can auto-fill the profile." },
  "newClient.creating": { de: "Erstelle...", en: "Creating..." },
  "newClient.createAndAnalyze": { de: "Anlegen & KI-Analyse starten", en: "Create & Start AI Analysis" },
  "newClient.create": { de: "Client anlegen", en: "Create Client" },

  // Information Page
  "info.loading": { de: "Laden…", en: "Loading…" },
  "info.addInfo": { de: "Info hinzufügen", en: "Add info" },
  "info.autoFill": { de: "Auto-fill", en: "Auto-fill" },
  "info.filling": { de: "Füllt aus…", en: "Filling…" },
  "info.scraping": { de: "Scraping profiles and extracting information with AI… this takes 15–30 seconds.", en: "Scraping profiles and extracting information with AI… this takes 15–30 seconds." },
  "info.links": { de: "Links", en: "Links" },
  "info.igProfile": { de: "Instagram Profil", en: "Instagram Profile" },
  "info.refresh": { de: "Aktualisieren", en: "Refresh" },
  "info.refreshing": { de: "Lädt…", en: "Loading…" },
  "info.profileLoading": { de: "Profil wird geladen…", en: "Loading profile…" },
  "info.follower": { de: "Follower", en: "Followers" },
  "info.following": { de: "Following", en: "Following" },
  "info.posts": { de: "Posts", en: "Posts" },
  "info.basicInfo": { de: "Basis-Informationen", en: "Basic Information" },
  "info.brandIdentity": { de: "Markenidentität", en: "Brand Identity" },
  "info.customerProblem": { de: "Kunde & Problem", en: "Customer & Problem" },
  "info.brandMessage": { de: "Markenbotschaft", en: "Brand Message" },
  "info.noInfoYet": { de: "Noch keine Informationen.", en: "No information added yet." },
  "info.addInformation": { de: "Informationen hinzufügen", en: "Add information" },
  "info.edit": { de: "Bearbeiten", en: "Edit" },
  "info.save": { de: "Speichern", en: "Save Changes" },
  "info.driveFolder": { de: "Google Drive Ordner", en: "Google Drive Folder" },
  "info.driveImport": { de: "Von Drive importieren", en: "Import from Drive" },
  "info.driveImporting": { de: "Importiere…", en: "Importing…" },
  "info.driveHint": { de: "Ordner muss mit der Service-Account-E-Mail geteilt werden", en: "Folder must be shared with the service account email" },
  "info.drivePlaceholder": { de: "https://drive.google.com/drive/folders/...", en: "https://drive.google.com/drive/folders/..." },
  "info.driveSuccess": { de: "{{count}} Dokument(e) importiert. Voice Profile generiert.", en: "{{count}} document(s) imported. Voice profile generated." },
  "info.driveSuccessNoVoice": { de: "{{count}} Dokument(e) importiert.", en: "{{count}} document(s) imported." },
  "info.saving": { de: "Wird gespeichert…", en: "Saving…" },

  // Follow-up dialog
  "followup.title": { de: "Profil vervollständigen", en: "Complete Profile" },
  "followup.answer": { de: "Deine Antwort…", en: "Your answer…" },
  "followup.skip": { de: "Überspringen", en: "Skip" },
  "followup.done": { de: "Fertig", en: "Done" },
  "followup.next": { de: "Weiter", en: "Next" },

  // Follow-up questions
  "fq.businessContext.label": { de: "Business Context", en: "Business Context" },
  "fq.businessContext.question": { de: "Was machst du genau, und wen hilfst du damit?", en: "What exactly do you do, and who do you help?" },
  "fq.professionalBackground.label": { de: "Beruflicher Hintergrund", en: "Professional Background" },
  "fq.professionalBackground.question": { de: "Was ist dein beruflicher Hintergrund und deine Expertise?", en: "What is your professional background and expertise?" },
  "fq.keyAchievements.label": { de: "Erfolge & Meilensteine", en: "Achievements & Milestones" },
  "fq.keyAchievements.question": { de: "Was sind deine größten Erfolge, Zahlen oder Auszeichnungen?", en: "What are your biggest achievements, numbers, or awards?" },
  "fq.brandFeeling.label": { de: "Gefühl das du verkaufst", en: "Feeling you sell" },
  "fq.brandFeeling.question": { de: "Welches Gefühl vermittelst du deinen Kunden? (z.B. Sicherheit, Klarheit, Freiheit)", en: "What feeling do you convey to your customers? (e.g. security, clarity, freedom)" },
  "fq.brandProblem.label": { de: "Kernproblem", en: "Core Problem" },
  "fq.brandProblem.question": { de: "Was ist das eine Problem das du für deine Kunden löst?", en: "What is the one problem you solve for your customers?" },
  "fq.providerRole.label": { de: "Deine Rolle", en: "Your Role" },
  "fq.providerRole.question": { de: "Wie würdest du deine Rolle beschreiben? (Mentor, Coach, Stratege, Sparringspartner...)", en: "How would you describe your role? (Mentor, Coach, Strategist, Sparring Partner...)" },
  "fq.providerBeliefs.label": { de: "Deine Überzeugungen", en: "Your Beliefs" },
  "fq.providerBeliefs.question": { de: "Was glaubst du, was in deiner Branche falsch gemacht wird?", en: "What do you think is being done wrong in your industry?" },
  "fq.providerStrengths.label": { de: "Deine Stärken", en: "Your Strengths" },
  "fq.providerStrengths.question": { de: "Was schätzen deine Kunden an dir am meisten?", en: "What do your customers appreciate most about you?" },
  "fq.brandingStatement.label": { de: "Branding Statement", en: "Branding Statement" },
  "fq.brandingStatement.question": { de: "Wie lautet dein Branding Statement? (Ich helfe [Zielgruppe], von [Ausgangspunkt], damit [Ergebnis].)", en: "What is your Branding Statement? (I help [target audience], from [starting point], so that [result].)" },
  "fq.humanDifferentiation.label": { de: "Dein AND-Faktor", en: "Your AND Factor" },
  "fq.humanDifferentiation.question": { de: "Was macht dich als Mensch einzigartig — dein AND-Faktor?", en: "What makes you unique as a person — your AND factor?" },

  // Add Info Dialog
  "addInfo.title": { de: "Informationen hinzufügen", en: "Add Information" },
  "addInfo.description": { de: "Füge beliebigen Text über diesen Client ein — Interview-Notizen, Bio, Fakten, Erfolge. Die KI ordnet es den richtigen Feldern zu.", en: "Paste any text about this client — interview notes, bio, facts, achievements. AI will place it into the right fields." },
  "addInfo.placeholder": { de: "z.B. Sie hat den Forbes 30 Under 30 Award gewonnen...", en: "e.g. She won the Forbes 30 Under 30 award in 2023..." },
  "addInfo.submit": { de: "Zum Profil hinzufügen", en: "Add to Profile" },
  "addInfo.processing": { de: "Wird verarbeitet…", en: "Processing…" },

  // Edit Dialogs - Basic Info
  "editBasic.title": { de: "Basis-Informationen bearbeiten", en: "Edit Basic Information" },
  "editBasic.fullName": { de: "Vollständiger Name", en: "Full Name" },
  "editBasic.company": { de: "Unternehmen", en: "Company" },
  "editBasic.role": { de: "Rolle", en: "Role" },
  "editBasic.location": { de: "Standort", en: "Location" },
  "editBasic.businessContext": { de: "Business Context", en: "Business Context" },
  "editBasic.professionalBackground": { de: "Beruflicher Hintergrund", en: "Professional Background" },
  "editBasic.keyAchievements": { de: "Erfolge & Meilensteine", en: "Key Achievements" },

  // Edit Dialogs - Brand
  "editBrand.title": { de: "Markenidentität", en: "Brand Identity" },
  "editBrand.feeling": { de: "Gefühl das du verkaufst (z.B. Sicherheit, Klarheit, Selbstvertrauen)", en: "Feeling you sell (e.g. security, clarity, confidence)" },
  "editBrand.problem": { de: "Kernproblem das du löst", en: "Core problem you solve" },
  "editBrand.dreamCustomer": { de: "Traumkunde-Profil", en: "Dream Customer Profile" },
  "editBrand.description": { de: "Konkrete Personenbeschreibung", en: "Concrete person description" },

  // Edit Dialogs - Customer
  "editCustomer.title": { de: "Kunde & Problem", en: "Customer & Problem" },
  "editCustomer.problems": { de: "Kundenprobleme", en: "Customer Problems" },
  "editCustomer.mental": { de: "Mentale Probleme", en: "Mental problems" },
  "editCustomer.physical": { de: "Physische Probleme", en: "Physical problems" },
  "editCustomer.financial": { de: "Finanzielle Probleme", en: "Financial problems" },
  "editCustomer.social": { de: "Soziale Probleme", en: "Social problems" },
  "editCustomer.aesthetic": { de: "Ästhetische Probleme", en: "Aesthetic problems" },
  "editCustomer.providerRole": { de: "Deine Rolle als Anbieter (Mentor? Stratege? Sparringspartner?)", en: "Your role as provider (Mentor? Strategist? Sparring partner?)" },
  "editCustomer.beliefs": { de: "Deine Überzeugungen (Was wird in deiner Branche falsch gemacht?)", en: "Your beliefs (What is being done wrong in your industry?)" },
  "editCustomer.strengths": { de: "Deine Stärken (Was schätzen deine Kunden am meisten?)", en: "Your strengths & skills (What do clients appreciate most?)" },
  "editCustomer.authenticity": { de: "Authentizitätszone (Wo überschneiden sich Kundenproblem und deine Stärke?)", en: "Authenticity zone (Where customer problem overlaps with your strength)" },

  // Edit Dialogs - Message
  "editMessage.title": { de: "Markenbotschaft", en: "Brand Message" },
  "editMessage.statement": { de: "Branding Statement", en: "Branding Statement" },
  "editMessage.statementHint": { de: "Formel: Ich helfe [Zielgruppe], von [Transformation], damit [Ergebnis].", en: "Formula: I help [target group], from [transformation], so that [result]." },
  "editMessage.statementPlaceholder": { de: "Ich helfe Selbständigen, Struktur in ihre Sichtbarkeit zu bringen…", en: "I help freelancers bring structure to their visibility…" },
  "editMessage.human": { de: "Menschliche Differenzierung — dein AND-Faktor", en: "Human differentiation — your AND factor" },
  "editMessage.humanHint": { de: "Du bist ein [Anbieter] UND...? Wie hebst du dich menschlich ab?", en: "You are a [provider] AND...? How do you stand out as a person?" },

  // Info labels
  "label.name": { de: "Name", en: "Name" },
  "label.company": { de: "Unternehmen", en: "Company" },
  "label.role": { de: "Rolle", en: "Role" },
  "label.location": { de: "Standort", en: "Location" },
  "label.businessContext": { de: "Business Context", en: "Business Context" },
  "label.professionalBackground": { de: "Beruflicher Hintergrund", en: "Professional Background" },
  "label.keyAchievements": { de: "Erfolge & Meilensteine", en: "Key Achievements" },
  "label.feelingYouSell": { de: "Gefühl das du verkaufst", en: "Feeling you sell" },
  "label.coreProblem": { de: "Kernproblem das du löst", en: "Core problem you solve" },
  "label.dreamCustomerProfile": { de: "Traumkunde-Profil", en: "Dream Customer Profile" },
  "label.description": { de: "Beschreibung", en: "Description" },
  "label.brandingStatement": { de: "Branding Statement", en: "Branding Statement" },
  "label.humanDifferentiation": { de: "Menschliche Differenzierung (dein AND-Faktor)", en: "Human differentiation (your AND factor)" },
  "label.providerRole": { de: "Deine Rolle als Anbieter", en: "Your role as provider" },
  "label.beliefs": { de: "Deine Überzeugungen", en: "Your beliefs" },
  "label.strengths": { de: "Deine Stärken", en: "Your strengths" },
  "label.authenticityZone": { de: "Authentizitätszone", en: "Authenticity zone" },
  "label.customerProblems": { de: "Kundenprobleme", en: "Customer Problems" },

  // Strategy Page
  "strategy.title": { de: "Strategie", en: "Strategy" },
  "strategy.subtitle": { de: "Content-Strategie und Performance-Insights", en: "Content strategy and performance insights" },
  "strategy.frameworkActive": { de: "Strategie-Framework aktiv", en: "Strategy Framework Active" },
  "strategy.perWeek": { de: "pro Woche", en: "per week" },
  "strategy.formats": { de: "Formate", en: "Formats" },
  "strategy.trainingExamples": { de: "Training-Beispiele", en: "Training Examples" },
  "strategy.viewFramework": { de: "Framework ansehen", en: "View Framework" },
  "strategy.performance": { de: "Performance-Analyse", en: "Performance Analysis" },
  "strategy.lastAnalyzed": { de: "Zuletzt analysiert:", en: "Last analyzed:" },
  "strategy.last": { de: "letzte", en: "last" },
  "strategy.days": { de: "Tage", en: "days" },
  "strategy.analyzing": { de: "Analysiert…", en: "Analyzing…" },
  "strategy.reanalyze": { de: "Neu analysieren", en: "Re-analyze" },
  "strategy.analyze": { de: "Analysieren", en: "Analyze" },
  "strategy.scrapingProfile": { de: "Instagram-Profil wird geladen…", en: "Loading Instagram profile…" },
  "strategy.downloadingVideos": { de: "Top-Videos werden analysiert…", en: "Analyzing top videos…" },
  "strategy.analyzingHooks": { de: "Hooks, Scripts und Performance werden ausgewertet…", en: "Evaluating hooks, scripts, and performance…" },
  "strategy.analysisDuration": { de: "Das dauert 1–3 Minuten.", en: "This takes 1–3 minutes." },
  "strategy.noAnalysis": { de: "Noch keine Analyse vorhanden.", en: "No analysis yet." },
  "strategy.analyzeHint": { de: "Analysieren klicken, um das Instagram-Profil zu laden und herauszufinden, was funktioniert.", en: "Click Analyze to load the Instagram profile and find out what works." },
  "strategy.topLast30": { de: "Top — Letzte 30 Tage", en: "Top — Last 30 Days" },
  "strategy.topLast": { de: "Top — Letzte", en: "Top — Last" },
  "strategy.excludingLast30": { de: "(ohne letzte 30)", en: "(excluding last 30)" },
  "strategy.showAnalysis": { de: "Analyse anzeigen ↓", en: "Show analysis ↓" },
  "strategy.hideAnalysis": { de: "Analyse ausblenden ↑", en: "Hide analysis ↑" },
  "strategy.scriptSummary": { de: "Skript", en: "Script" },
  "strategy.whyItWorked": { de: "Warum erfolgreich", en: "Why it worked" },
  "strategy.howToReplicate": { de: "Wie replizieren", en: "How to replicate" },
  "strategy.contentStrategy": { de: "Content-Strategie", en: "Content Strategy" },
  "strategy.generating": { de: "Generiert…", en: "Generating…" },
  "strategy.generateWithAI": { de: "Mit KI generieren", en: "Generate with AI" },
  "strategy.editStrategy": { de: "Bearbeiten", en: "Edit" },
  "strategy.aiGenerating": { de: "KI analysiert das Kundenprofil und erstellt eine Strategie…", en: "AI is analyzing the customer profile and creating a strategy…" },
  "strategy.trainingConsidered": { de: "Training-Beispiele aus der Strategie-Bibliothek werden berücksichtigt.", en: "Training examples from the strategy library are being considered." },
  "strategy.noStrategy": { de: "Noch keine Strategie vorhanden.", en: "No strategy yet." },
  "strategy.aiSuggestion": { de: "KI erstellt einen Vorschlag basierend auf dem Kundenprofil", en: "AI creates a suggestion based on the customer profile" },
  "strategy.savedTraining": { de: "gespeicherten Training-Beispielen", en: "saved training examples" },
  "strategy.addManually": { de: "Manuell hinzufügen", en: "Add manually" },
  "strategy.primaryGoal": { de: "Primäres Ziel", en: "Primary Goal" },
  "strategy.contentPillars": { de: "Content Pillars", en: "Content Pillars" },
  "strategy.weeklyCalendar": { de: "Wöchentlicher Kalender", en: "Weekly Calendar" },
  "strategy.postsPerWeek": { de: "Posts / Woche", en: "Posts / Week" },
  "strategy.contentTypesUsed": { de: "Diese Woche verwendete Content Types — aus dem Framework", en: "Content types used this week — from the framework" },

  // Strategy Edit Dialog
  "strategyEdit.title": { de: "Strategie bearbeiten", en: "Edit Strategy" },
  "strategyEdit.primaryGoal": { de: "Primäres Ziel", en: "Primary Goal" },
  "strategyEdit.addPillar": { de: "Pillar hinzufügen", en: "Add Pillar" },
  "strategyEdit.subTopics": { de: "Unter-Themen", en: "Sub-topics" },
  "strategyEdit.noPillars": { de: "Noch keine Pillars — bis zu 5 möglich.", en: "No pillars yet — up to 5 possible." },
  "strategyEdit.weeklyStructure": { de: "Wöchentliche Struktur", en: "Weekly Structure" },
  "strategyEdit.save": { de: "Strategie speichern", en: "Save Strategy" },

  // Scripts Page
  "scripts.draft": { de: "Entwurf", en: "Draft" },
  "scripts.ready": { de: "Bereit", en: "Ready" },
  "scripts.published": { de: "Veröffentlicht", en: "Published" },
  "scripts.untitled": { de: "Unbenanntes Skript", en: "Untitled Script" },
  "scripts.copied": { de: "Kopiert", en: "Copied" },
  "scripts.copyScript": { de: "Skript kopieren", en: "Copy Script" },
  "scripts.apply": { de: "Übernehmen", en: "Apply" },
  "scripts.cancel": { de: "Abbrechen", en: "Cancel" },
  "scripts.changeTopic": { de: "Thema ändern", en: "Change Topic" },
  "scripts.writeScript": { de: "Skript schreiben", en: "Write Script" },
  "scripts.writing": { de: "Skript wird geschrieben…", en: "Writing script…" },
  "scripts.strategyProfile": { de: "Strategie + Profil", en: "Strategy + Profile" },

  // Training Page
  "training.contentFormats": { de: "Content Formate", en: "Content Formats" },
  "training.confirmDelete": { de: "Skript wirklich löschen?", en: "Really delete script?" },
  "training.less": { de: "Weniger", en: "Less" },
  "training.scriptDone": { de: "Skript fertig", en: "Script Done" },
  "training.saved": { de: "Gespeichert", en: "Saved" },
  "training.title": { de: "Training & Framework", en: "Training & Framework" },
  "training.subtitle": { de: "Referenzskripte, Content Types und Formate für die KI", en: "Reference scripts, content types, and formats for AI" },
  "training.textHook": { de: "Text Hook", en: "Text Hook" },
  "training.visualHook": { de: "Visual Hook", en: "Visual Hook" },
  "training.audioHook": { de: "Audio Hook", en: "Audio Hook" },
  "training.scriptLabel": { de: "Skript", en: "Script" },
  "training.cta": { de: "CTA", en: "CTA" },
  "training.allClients": { de: "Alle Kunden", en: "All Clients" },
  "training.noClientGeneral": { de: "Allgemein (kein Kunde)", en: "General (no client)" },
  "training.allFormats": { de: "Alle Formate", en: "All Formats" },
  "training.reset": { de: "Zurücksetzen", en: "Reset" },
  "training.scriptCount": { de: "Skript", en: "script" },
  "training.scriptsCount": { de: "Skripte", en: "scripts" },
  "training.newScript": { de: "Neues Skript", en: "New Script" },
  "training.loadingScripts": { de: "Lade Skripte…", en: "Loading scripts…" },
  "training.noScripts": { de: "Noch keine Skripte", en: "No scripts yet" },
  "training.noResults": { de: "Keine Ergebnisse", en: "No results" },
  "training.addFirst": { de: "Füge dein erstes erfolgreiches Skript hinzu", en: "Add your first successful script" },
  "training.adjustFilter": { de: "Passe den Filter an", en: "Adjust the filter" },
  "training.addFirstBtn": { de: "Erstes Skript hinzufügen", en: "Add First Script" },
  "training.editScript": { de: "Skript bearbeiten", en: "Edit Script" },
  "training.newTrainingScript": { de: "Neues Training-Skript", en: "New Training Script" },
  "training.client": { de: "Kunde", en: "Client" },
  "training.noClient": { de: "Kein Kunde (allgemein)", en: "No client (general)" },
  "training.format": { de: "Format", en: "Format" },
  "training.select": { de: "Auswählen…", en: "Select…" },
  "training.textHookPlaceholder": { de: "On-Screen Text…", en: "On-screen text…" },
  "training.visualHookPlaceholder": { de: "Was ist zu sehen in der ersten Sekunde…", en: "What is visible in the first second…" },
  "training.audioHookPlaceholder": { de: "Was wird gesagt / welcher Sound…", en: "What is said / which sound…" },
  "training.scriptPlaceholder": { de: "Hauptteil des Skripts…", en: "Main body of the script…" },
  "training.ctaPlaceholder": { de: "Call to Action…", en: "Call to Action…" },
  "training.saveChanges": { de: "Änderungen speichern", en: "Save Changes" },
  "training.addScript": { de: "Skript hinzufügen", en: "Add Script" },
  "training.deleteType": { de: "Content Type löschen?", en: "Delete content type?" },
  "training.typesReadonly": { de: "Eingebaute Types sind schreibgeschützt. Eigene können hinzugefügt, bearbeitet und gelöscht werden.", en: "Built-in types are read-only. Custom ones can be added, edited, and deleted." },
  "training.newType": { de: "Neuer Type", en: "New Type" },
  "training.builtIn": { de: "Eingebaut", en: "Built-in" },
  "training.custom": { de: "Eigene", en: "Custom" },
  "training.idealFor": { de: "Ideal für:", en: "Ideal for:" },
  "training.editType": { de: "Content Type bearbeiten", en: "Edit Content Type" },
  "training.newContentType": { de: "Neuer Content Type", en: "New Content Type" },
  "training.name": { de: "Name", en: "Name" },
  "training.typeNamePlaceholder": { de: "z.B. Case Study", en: "e.g. Case Study" },
  "training.typeGoal": { de: "Ziel — was soll dieser Type erreichen?", en: "Goal — what should this type achieve?" },
  "training.typeGoalPlaceholder": { de: "z.B. Vertrauen aufbauen durch echte Ergebnisse von Kunden", en: "e.g. Build trust through real customer results" },
  "training.typeBestFor": { de: "Ideal für — wann einsetzen?", en: "Ideal for — when to use?" },
  "training.typeBestForPlaceholder": { de: "z.B. Wenn Kunden bereits warm sind und kurz vor einer Kaufentscheidung stehen", en: "e.g. When customers are already warm and close to a buying decision" },
  "training.deleteFormat": { de: "Format löschen?", en: "Delete format?" },
  "training.formatsReadonly": { de: "Eingebaute Formate sind schreibgeschützt. Eigene können hinzugefügt, bearbeitet und gelöscht werden.", en: "Built-in formats are read-only. Custom ones can be added, edited, and deleted." },
  "training.newFormat": { de: "Neues Format", en: "New Format" },
  "training.editFormat": { de: "Format bearbeiten", en: "Edit Format" },
  "training.newContentFormat": { de: "Neues Content Format", en: "New Content Format" },
  "training.formatNamePlaceholder": { de: "z.B. Split-Screen", en: "e.g. Split-Screen" },
  "training.formatDesc": { de: "Beschreibung — was ist dieses Format?", en: "Description — what is this format?" },
  "training.formatDescPlaceholder": { de: "z.B. Zwei Videos nebeneinander — eins zeigt das Problem, eins die Lösung", en: "e.g. Two videos side by side — one shows the problem, one the solution" },
  "training.formatTypes": { de: "Passt zu welchen Content Types?", en: "Which content types does it fit?" },
  "training.formatTypesPlaceholder": { de: "z.B. Education, Opinion, Social Proof", en: "e.g. Education, Opinion, Social Proof" },
  "training.platform": { de: "Plattform", en: "Platform" },
  "training.platformPlaceholder": { de: "z.B. Reels, TikTok", en: "e.g. Reels, TikTok" },

  // Common
  "common.save": { de: "Speichern", en: "Save" },
  "common.cancel": { de: "Abbrechen", en: "Cancel" },
  "common.edit": { de: "Bearbeiten", en: "Edit" },
  "common.delete": { de: "Löschen", en: "Delete" },
  "common.loading": { de: "Laden…", en: "Loading…" },
  "common.more": { de: "Mehr", en: "More" },
  "common.less": { de: "Weniger", en: "Less" },
  "common.saved": { de: "Gespeichert", en: "Saved" },
  "common.saving": { de: "Speichert…", en: "Saving…" },
  "common.add": { de: "Hinzufügen", en: "Add" },
  "common.search": { de: "Suche", en: "Search" },
  "common.refreshAll": { de: "Alle aktualisieren", en: "Refresh All" },

  // New Client Page (empty state)
  "newClient.empty": { de: "Noch keine Clients", en: "No clients yet" },
  "newClient.emptyHint": { de: "Klicke auf \"Neuer Client\" in der Sidebar um zu starten.", en: "Click \"New Client\" in the sidebar to get started." },

  // Creators Page
  "creators.title": { de: "Creators", en: "Creators" },
  "creators.subtitle": { de: "Verfolgte Competitor-Accounts für", en: "Tracked competitor accounts for" },
  "creators.thisClient": { de: "diesen Kunden", en: "this client" },
  "creators.addManual": { de: "Manuell hinzufügen", en: "Add manually" },
  "creators.editCreator": { de: "Creator bearbeiten", en: "Edit Creator" },
  "creators.addCreator": { de: "Creator hinzufügen", en: "Add Creator" },
  "creators.igUsername": { de: "Instagram Username", en: "Instagram Username" },
  "creators.placeholder": { de: "z.B. garyvee", en: "e.g. garyvee" },
  "creators.category": { de: "Kategorie", en: "Category" },
  "creators.autoSet": { de: "Automatisch gesetzt:", en: "Auto-set:" },
  "creators.autoScrape": { de: "Profilbild, Follower und Aktivitätsdaten werden automatisch geladen.", en: "Profile picture, followers, and activity data will be loaded automatically." },
  "creators.addingTo": { de: "Füge hinzu…", en: "Adding…" },
  "creators.savingCreator": { de: "Speichert…", en: "Saving…" },
  "creators.research": { de: "Creators recherchieren", en: "Research Creators" },
  "creators.aiResearch": { de: "KI-Recherche", en: "AI Research" },
  "creators.aiResearchDesc": { de: "Findet die besten Creator, größten Persönlichkeiten und interessantesten Charaktere in der Nische", en: "Finds the best creators, biggest personalities, and most interesting characters in the niche" },
  "creators.focusPlaceholder": { de: "Optionaler Fokus, z.B. 'nur Dubai-basierte', 'unter 500K', 'besonders polarisierende Charaktere'…", en: "Optional focus, e.g. 'Dubai-based only', 'under 500K', 'especially polarizing characters'…" },
  "creators.researching": { de: "Recherchiert…", en: "Researching…" },
  "creators.researchBtn": { de: "Recherchieren", en: "Research" },
  "creators.aiSearching": { de: "KI sucht die größten Creator in der Nische…", en: "AI is searching for the biggest creators in the niche…" },
  "creators.focusMega": { de: "Fokus auf Mega- und Macro-Creator mit hoher Reichweite oder virale Accounts.", en: "Focus on Mega and Macro creators with high reach or viral accounts." },
  "creators.aiBanner": { de: "KI-Vorschläge — klick auf <strong>@username</strong> um das Profil auf Instagram zu prüfen, bevor du hinzufügst. Follower-Daten werden nach dem Hinzufügen live abgerufen.", en: "AI suggestions — click <strong>@username</strong> to check the profile on Instagram before adding. Follower data will be fetched live after adding." },
  "creators.suggestionsFound": { de: "Vorschläge gefunden:", en: "suggestions found:" },
  "creators.profileHint": { de: "Klick auf @username öffnet das Instagram-Profil zur Prüfung. Nach dem Hinzufügen werden Follower-Zahlen automatisch abgerufen.", en: "Click @username to open the Instagram profile for review. After adding, follower counts are fetched automatically." },
  "creators.startResearch": { de: "KI-Recherche starten", en: "Start AI Research" },
  "creators.verified": { de: "✓ verifiziert", en: "✓ verified" },
  "creators.confident": { de: "✓ sicher", en: "✓ confident" },
  "creators.likely": { de: "~ wahrscheinlich", en: "~ likely" },
  "creators.uncertain": { de: "? unsicher", en: "? uncertain" },
  "creators.added": { de: "Hinzugefügt", en: "Added" },
  "creators.verifying": { de: "Verifiziere…", en: "Verifying…" },
  "creators.confirmDelete": { de: "Creator löschen?", en: "Delete creator?" },
  "creators.notFound": { de: "nicht auf Instagram gefunden", en: "not found on Instagram" },
  "creators.noData": { de: "Noch keine Daten —", en: "No data yet —" },
  "creators.clickScrape": { de: "Daten laden", en: "load data" },
  "creators.scraped": { de: "Aktuell", en: "Up to date" },
  "creators.viewVideos": { de: "Videos ansehen", en: "View videos" },
  "creators.noCreators": { de: "Noch keine Creators", en: "No creators yet" },
  "creators.noCreatorsHint": { de: "Lass die KI die besten Creators in der Nische finden oder füge manuell hinzu.", en: "Let AI find the best creators in the niche or add manually." },
  "creators.researchFailed": { de: "Recherche fehlgeschlagen", en: "Research failed" },

  // Transcribe Page
  "transcribe.title": { de: "Transkribieren", en: "Transcribe" },
  "transcribe.subtitle": { de: "Reels, TikToks und YouTube Shorts transkribieren", en: "Transcribe Reels, TikToks, and YouTube Shorts" },
  "transcribe.placeholder": { de: "Video-URL einfügen…", en: "Paste video URL…" },
  "transcribe.transcribing": { de: "Transkribiert…", en: "Transcribing…" },
  "transcribe.transcribe": { de: "Transkribieren", en: "Transcribe" },
  "transcribe.igLoading": { de: "Reel wird geladen und transkribiert…", en: "Loading and transcribing reel…" },
  "transcribe.ytLoading": { de: "YouTube-Video wird verarbeitet…", en: "Processing YouTube video…" },
  "transcribe.genericLoading": { de: "Video wird verarbeitet…", en: "Video is being processed…" },
  "transcribe.duration": { de: "Das kann 30–60 Sekunden dauern.", en: "This may take 30–60 seconds." },
  "transcribe.errorGeneric": { de: "Fehler beim Transkribieren", en: "Transcription error" },
  "transcribe.errorUnknown": { de: "Unbekannter Fehler", en: "Unknown error" },
  "transcribe.transcript": { de: "Transkript", en: "Transcript" },
  "transcribe.copied": { de: "Kopiert", en: "Copied" },
  "transcribe.copy": { de: "Kopieren", en: "Copy" },
  "transcribe.saveAsTraining": { de: "Als Training-Skript speichern", en: "Save as Training Script" },
  "transcribe.saveTitle": { de: "Als Training-Skript speichern", en: "Save as Training Script" },
  "transcribe.client": { de: "Kunde", en: "Client" },
  "transcribe.noClient": { de: "Kein Kunde (allgemein)", en: "No client (general)" },
  "transcribe.clientHint": { de: "Transkripte werden dem Kunden zugeordnet und trainieren seinen Sprachstil", en: "Transcripts are assigned to the client and train their voice style" },
  "transcribe.titleLabel": { de: "Titel", en: "Title" },
  "transcribe.titlePlaceholder": { de: "z.B. Starker Authority-Hook", en: "e.g. Strong Authority Hook" },
  "transcribe.contentType": { de: "Content-Typ", en: "Content Type" },
  "transcribe.format": { de: "Format", en: "Format" },
  "transcribe.selectOption": { de: "Auswählen…", en: "Select…" },
  "transcribe.niche": { de: "Nische", en: "Niche" },
  "transcribe.nichePlaceholder": { de: "z.B. Business Coaching, Fitness…", en: "e.g. Business Coaching, Fitness…" },
  "transcribe.script": { de: "Skript", en: "Script" },
  "transcribe.notes": { de: "Notizen (optional)", en: "Notes (optional)" },
  "transcribe.notesPlaceholder": { de: "Warum funktioniert das Skript?", en: "Why does this script work?" },

  // Audit Landing Page
  "audit.hero.label": { de: "KOSTENLOSER STRATEGIE-SCAN", en: "FREE STRATEGY SCAN" },
  "audit.hero.title": { de: "Dein Instagram Strategie-Scan", en: "Your Instagram Strategy Scan" },
  "audit.hero.subtitle": { de: "Finde heraus, was dein Instagram-Profil zurückhält — und was du sofort ändern kannst, um mehr Reichweite zu bekommen.", en: "Find out what's holding your Instagram profile back — and what you can change right now to get more reach." },
  "audit.form.firstName": { de: "Vorname", en: "First Name" },
  "audit.form.lastName": { de: "Nachname", en: "Last Name" },
  "audit.form.email": { de: "E-Mail", en: "Email" },
  "audit.form.instagram": { de: "Instagram Handle", en: "Instagram Handle" },
  "audit.form.submit": { de: "Kostenlosen Strategie-Scan starten", en: "Start Free Strategy Scan" },
  "audit.form.submitting": { de: "Wird analysiert…", en: "Analyzing…" },
  "audit.form.required": { de: "Bitte fülle alle Felder aus.", en: "Please fill in all fields." },
  "audit.form.invalidEmail": { de: "Bitte gib eine gültige E-Mail-Adresse ein.", en: "Please enter a valid email address." },
  "audit.progress.scraping": { de: "Profil wird geladen…", en: "Loading profile…" },
  "audit.progress.reels": { de: "Videos werden analysiert…", en: "Analyzing videos…" },
  "audit.progress.analyzing": { de: "Verbesserungspotenziale werden ermittelt & Strategie wird erstellt…", en: "Identifying areas for improvement & building strategy…" },
  "audit.progress.done": { de: "Strategie-Scan abgeschlossen!", en: "Strategy scan complete!" },
  "audit.trust.profiles": { de: "100+ Profile analysiert", en: "100+ Profiles analyzed" },
  "audit.trust.speed": { de: "In 30 Sekunden", en: "In 30 seconds" },
  "audit.trust.tips": { de: "Konkrete Tipps", en: "Actionable tips" },
  "audit.report.title": { de: "Dein Strategie-Scan", en: "Your Strategy Scan" },
  "audit.report.followers": { de: "Follower", en: "Followers" },
  "audit.report.reels30d": { de: "Reels (30 Tage)", en: "Reels (30 days)" },
  "audit.report.avgViews": { de: "Ø Views", en: "Avg Views" },
  "audit.cta.title": { de: "Willst du mehr?", en: "Want more?" },
  "audit.cta.subtitle": { de: "Lass uns gemeinsam eine Content-Strategie bauen, die zu dir und deiner Marke passt.", en: "Let's build a content strategy together that fits you and your brand." },
  "audit.cta.button": { de: "Termin buchen", en: "Book a call" },
  "audit.error.notFound": { de: "Instagram-Profil konnte nicht gefunden werden. Prüfe den Handle und versuche es erneut.", en: "Instagram profile could not be found. Check the handle and try again." },
  "audit.error.generic": { de: "Ein Fehler ist aufgetreten. Bitte versuche es erneut.", en: "An error occurred. Please try again." },
  "audit.newAudit": { de: "Neuen Strategie-Scan starten", en: "Start new strategy scan" },

  // Scripts Page extras
  "scripts.regenerate": { de: "Neu generieren", en: "Regenerate" },
  "scripts.saved": { de: "Gespeichert", en: "Saved" },
  "scripts.save": { de: "Speichern", en: "Save" },
  "scripts.ownVideos": { de: "eigene Videos", en: "own videos" },
  "scripts.noOwnAnalysis": { de: "Keine eigene Analyse", en: "No own analysis" },
  "scripts.creatorVideos": { de: "Creator-Videos", en: "Creator videos" },
  "scripts.noCreatorVideos": { de: "Keine Creator-Videos", en: "No creator videos" },
  "scripts.12months": { de: "12 Monate", en: "12 months" },

  // Virality Checklist Page
  "vc.title": { de: "Virality Checklist", en: "Virality Checklist" },
  "vc.subtitle": { de: "4-Schritte Framework: Research → Script → Film → Edit", en: "4-Step Framework: Research → Script → Film → Edit" },
  "vc.tipsTitle": { de: "Tipps & Insights", en: "Tips & Insights" },
  "vc.checklist": { de: "Checklist", en: "Checklist" },
  "vc.principles": { de: "10 Psychologische Prinzipien", en: "10 Psychological Principles" },

  // Steps
  "vc.step.research": { de: "Research", en: "Research" },
  "vc.step.research.sub": { de: "Doom-Scrolling mit Intent", en: "Doom-Scrolling with Intent" },
  "vc.step.scripting": { de: "Scripting", en: "Scripting" },
  "vc.step.scripting.sub": { de: "Copy → Adapt → Simplify", en: "Copy → Adapt → Simplify" },
  "vc.step.filming": { de: "Filming", en: "Filming" },
  "vc.step.filming.sub": { de: "iPhone + CapCut Teleprompter", en: "iPhone + CapCut Teleprompter" },
  "vc.step.editing": { de: "Editing", en: "Editing" },
  "vc.step.editing.sub": { de: "CapCut auf dem iPhone", en: "CapCut on iPhone" },

  // Research Tips
  "vc.research.tip1.title": { de: "Outlier finden, nicht irgendwas", en: "Find outliers, not just anything" },
  "vc.research.tip1.detail": { de: "Such Videos mit 5.000–10.000+ Likes. Das ist der Indikator dass der Algorithmus das Video pusht. Besonders stark: 1M Views auf einem 68K-Follower-Account.", en: "Look for videos with 5,000–10,000+ likes. That's the indicator the algorithm is pushing the video. Especially powerful: 1M views on a 68K-follower account." },
  "vc.research.tip2.title": { de: "Nische UND Format matchen", en: "Match niche AND format" },
  "vc.research.tip2.detail": { de: "Nicht nur Nische ODER Format — beides muss passen. Ein virales Kochvideo hilft dir nicht wenn du Business-Content machst, selbst wenn das Format ähnlich ist.", en: "Not just niche OR format — both must match. A viral cooking video won't help if you make business content, even if the format is similar." },
  "vc.research.tip3.title": { de: "Algorithmus = Watch Time", en: "Algorithm = Watch Time" },
  "vc.research.tip3.detail": { de: "Vergiss Hashtags. Vergiss Posting-Zeiten. Der Algorithmus optimiert einzig und allein für Watch Time und Engagement. Das ist die einzige Metrik die zählt.", en: "Forget hashtags. Forget posting times. The algorithm optimizes solely for watch time and engagement. That's the only metric that matters." },
  "vc.research.tip4.title": { de: "Outlier erkennen", en: "Spot outliers" },
  "vc.research.tip4.detail": { de: "Check ob das Video ein Outlier für DIESEN Creator ist. 100K Views auf einem Account mit 2M Followern ist normal — 100K Views auf einem Account mit 5K Followern ist ein Outlier.", en: "Check if the video is an outlier for THIS creator. 100K views on an account with 2M followers is normal — 100K views on an account with 5K followers is an outlier." },

  // Scripting Tips
  "vc.scripting.tip1.title": { de: "Hook = Make or Break", en: "Hook = Make or Break" },
  "vc.scripting.tip1.detail": { de: "Der erste Satz entscheidet ALLES. Er muss die Wünsche und Desires deines idealen Zuschauers ansprechen. Jeder weitere Satz muss auf den Hook zurückführen.", en: "The first sentence decides EVERYTHING. It must address the desires of your ideal viewer. Every subsequent sentence must lead back to the hook." },
  "vc.scripting.tip2.title": { de: "Copy → Adapt → Simplify", en: "Copy → Adapt → Simplify" },
  "vc.scripting.tip2.detail": { de: "Öffne ein Google Doc. Schreib die Original-Sätze Zeile für Zeile ab. Darunter: DEINE Version in DEINER Nische. Denk kritisch darüber nach WARUM es viral ging.", en: "Open a Google Doc. Write down the original sentences line by line. Below: YOUR version in YOUR niche. Think critically about WHY it went viral." },
  "vc.scripting.tip3.title": { de: "5-Jährigen-Test", en: "5-Year-Old Test" },
  "vc.scripting.tip3.detail": { de: "Ein 5-Jähriger sollte es verstehen. Kein Fachjargon. Kein PhD-Dissertations-Vibe. Short Form = ein schneller Dopamin-Hit, nicht eine Vorlesung.", en: "A 5-year-old should understand it. No jargon. No PhD dissertation vibe. Short form = a quick dopamine hit, not a lecture." },
  "vc.scripting.tip4.title": { de: "Dopamin-Hits einbauen", en: "Build in dopamine hits" },
  "vc.scripting.tip4.detail": { de: "Gib dem Zuschauer das Gefühl dass er gewinnt, nur weil er zuschaut. Die meisten speichern Content und wenden ihn nie an — mach dass sie sich fühlen als machen sie Fortschritt.", en: "Make the viewer feel like they're winning just by watching. Most save content and never apply it — make them feel like they're making progress." },
  "vc.scripting.tip5.title": { de: "Scroll-off Gründe eliminieren", en: "Eliminate scroll-off reasons" },
  "vc.scripting.tip5.detail": { de: "Les das Skript laut vor. Frag: 'Wenn ich ein Fremder wäre — würde ich hier wegwischen?' 3 Gründe zum Wegwischen: verwirrt, gelangweilt, aufgehört zu glauben.", en: "Read the script out loud. Ask: 'If I were a stranger — would I swipe away here?' 3 reasons to swipe: confused, bored, stopped believing." },
  "vc.scripting.tip6.title": { de: "One Quick Win", en: "One Quick Win" },
  "vc.scripting.tip6.detail": { de: "Versuch nicht in 60 Sekunden alles zu erklären. Der Zuschauer soll EINE Sache verstehen. EIN Gefühl von Verständnis. Das reicht.", en: "Don't try to explain everything in 60 seconds. The viewer should understand ONE thing. ONE feeling of understanding. That's enough." },

  // Filming Tips
  "vc.filming.tip1.title": { de: "High Energy State", en: "High Energy State" },
  "vc.filming.tip1.detail": { de: "Vor dem Filmen: Energy Drink, Stretching, tiefe Atemzüge. Noise-Cancelling Kopfhörer mit Focus-Musik. Du musst vom Business-Brain ins charismatische-Kamera-Person-Brain switchen.", en: "Before filming: energy drink, stretching, deep breaths. Noise-cancelling headphones with focus music. You need to switch from business-brain to charismatic-camera-person-brain." },
  "vc.filming.tip2.title": { de: "Teleprompter Hack", en: "Teleprompter Hack" },
  "vc.filming.tip2.detail": { de: "CapCut → Kamera → Kamera drehen → 3 Minuten → Teleprompter. Skript reinkopieren. Ziel: Es soll NICHT aussehen als würdest du ablesen. Natürliche Energie, keine übertriebenen Worte.", en: "CapCut → Camera → Flip camera → 3 minutes → Teleprompter. Paste script. Goal: It should NOT look like you're reading. Natural energy, no exaggerated words." },
  "vc.filming.tip3.title": { de: "Stell dir jemanden vor", en: "Imagine someone" },
  "vc.filming.tip3.detail": { de: "Visualisiere eine Person die vor dir sitzt. Der Zuschauer soll das Gefühl haben mit einem echten Menschen zu reden — nicht mit einem Roboter der ein Skript abliest.", en: "Visualize a person sitting in front of you. The viewer should feel like they're talking to a real person — not a robot reading a script." },
  "vc.filming.tip4.title": { de: "Kein fancy Equipment nötig", en: "No fancy equipment needed" },
  "vc.filming.tip4.detail": { de: "iPhone reicht völlig. Stapel Bücher für den Desk-Shot. Du musst es nicht in einem Take schaffen — mach Fehler, film weiter, schneide in der Bearbeitung.", en: "iPhone is totally enough. Stack of books for the desk shot. You don't have to nail it in one take — make mistakes, keep filming, cut in editing." },

  // Editing Tips
  "vc.editing.tip1.title": { de: "4-Schritte Editing-Prozess", en: "4-Step Editing Process" },
  "vc.editing.tip1.detail": { de: "1) Rough Cut — Stille und Fehler rausschneiden. 2) B-Roll — Clips die zum Gesagten passen. 3) Auto-Captions — TikTok Classic Font. 4) Musik — nur instrumental.", en: "1) Rough Cut — cut silence and mistakes. 2) B-Roll — clips that match what's said. 3) Auto-Captions — TikTok Classic Font. 4) Music — instrumental only." },
  "vc.editing.tip2.title": { de: "Dead Space = Tod", en: "Dead Space = Death" },
  "vc.editing.tip2.detail": { de: "Schneide ALLE Atempausen, Versprecher, Stille raus. Selbst 0,5 Sekunden Dead Space lässt das Video langsamer wirken. Besonders wichtig für neue Creator.", en: "Cut ALL breathing pauses, slip-ups, silence. Even 0.5 seconds of dead space makes the video feel slower. Especially important for new creators." },
  "vc.editing.tip3.title": { de: "B-Roll Philosophie", en: "B-Roll Philosophy" },
  "vc.editing.tip3.detail": { de: "Plan eine Shot-Liste vom Skript BEVOR du B-Roll filmst. Jeder Satz = ein spezifisches Visual. Was macht diesen Satz EINFACHER zu verstehen? Screen Recordings für App-Demos. Jeder Clip: 1-2 Sekunden max.", en: "Plan a shot list from the script BEFORE filming B-Roll. Every sentence = a specific visual. What makes this sentence EASIER to understand? Screen recordings for app demos. Each clip: 1-2 seconds max." },
  "vc.editing.tip4.title": { de: "5% Intentionality Principle", en: "5% Intentionality Principle" },
  "vc.editing.tip4.detail": { de: "5% mehr Intention pro Satz = potenziell 10x mehr Views. Kleine Unterschiede in Retention kompoundieren massiv. Denk bei JEDEM Visual darüber nach warum es da ist.", en: "5% more intention per sentence = potentially 10x more views. Small differences in retention compound massively. Think about WHY every visual is there." },
  "vc.editing.tip5.title": { de: "Social Proof früh zeigen", en: "Show social proof early" },
  "vc.editing.tip5.detail": { de: "Screenshots von View-Zahlen in den ersten Sekunden. Auf die Zahlen zuschneiden — kein Clutter. Beweist dass es sich lohnt dir zuzuhören.", en: "Screenshots of view counts in the first seconds. Crop to the numbers — no clutter. Proves it's worth listening to you." },
  "vc.editing.tip6.title": { de: "Captions & Musik", en: "Captions & Music" },
  "vc.editing.tip6.detail": { de: "TikTok Classic Font. Augen müssen sichtbar bleiben. Gelbe Captions wenn der Hintergrund Kontrast braucht. Return drücken: 2 Wörter pro Zeile. Musik: nur instrumental, keine Lyrics.", en: "TikTok Classic Font. Eyes must stay visible. Yellow captions when background needs contrast. Hit return: 2 words per line. Music: instrumental only, no lyrics." },
  "vc.editing.tip7.title": { de: "Export-Settings", en: "Export Settings" },
  "vc.editing.tip7.detail": { de: "4K Auflösung. KEIN AI Ultra HD. 30 fps. Empfohlene Bitrate. Caption/Beschreibung ist nicht so wichtig — keine Hashtags oder Posting-Zeiten nötig.", en: "4K resolution. NO AI Ultra HD. 30 fps. Recommended bitrate. Caption/description isn't that important — no hashtags or posting times needed." },
  "vc.editing.tip8.title": { de: "Speed = Value Perception", en: "Speed = Value Perception" },
  "vc.editing.tip8.detail": { de: "Langweilige Teile (Tippen, Scrollen) 3-5x beschleunigen. Schnell wechselnde Visuals lassen Content wertvoller und speichernswert erscheinen. Visuelle Einfachheit — EIN Fokuspunkt pro Frame.", en: "Speed up boring parts (typing, scrolling) 3-5x. Fast-changing visuals make content feel more valuable and save-worthy. Visual simplicity — ONE focal point per frame." },

  // Research Checklist
  "vc.research.cl1": { de: "Instagram/TikTok Explore/FYP öffnen", en: "Open Instagram/TikTok Explore/FYP" },
  "vc.research.cl2": { de: "Videos mit 5.000-10.000+ Likes finden", en: "Find videos with 5,000-10,000+ likes" },
  "vc.research.cl3": { de: "Check: Ist es ein Outlier für diesen Creator?", en: "Check: Is it an outlier for this creator?" },
  "vc.research.cl4": { de: "Passt es zu deiner Nische UND deinem Format?", en: "Does it match your niche AND format?" },
  "vc.research.cl5": { de: "3-5 virale Referenz-Videos gesammelt", en: "Collected 3-5 viral reference videos" },

  // Scripting Checklist
  "vc.scripting.cl1": { de: "Google Doc öffnen", en: "Open Google Doc" },
  "vc.scripting.cl2": { de: "Original-Sätze Zeile für Zeile abschreiben", en: "Copy original sentences line by line" },
  "vc.scripting.cl3": { de: "Eigene Version in eigener Nische darunter schreiben", en: "Write your own version in your niche below" },
  "vc.scripting.cl4": { de: "Hook = erster Satz der Aufmerksamkeit catcht", en: "Hook = first sentence that catches attention" },
  "vc.scripting.cl5": { de: "Jeder Satz führt zurück zum Hook", en: "Every sentence leads back to the hook" },
  "vc.scripting.cl6": { de: "5-Jährigen-Test bestanden (kein Fachjargon)", en: "Passed 5-year-old test (no jargon)" },
  "vc.scripting.cl7": { de: "Skript laut vorgelesen", en: "Read script out loud" },
  "vc.scripting.cl8": { de: "Kein Punkt wo man wegwischen würde", en: "No point where you'd swipe away" },
  "vc.scripting.cl9": { de: "Dopamin-Hits eingebaut", en: "Dopamine hits built in" },

  // Filming Checklist
  "vc.filming.cl1": { de: "High-Energy-State aufgebaut", en: "Built up high-energy state" },
  "vc.filming.cl2": { de: "Teleprompter in CapCut eingerichtet", en: "Set up teleprompter in CapCut" },
  "vc.filming.cl3": { de: "Kamera-Setup bereit (iPhone + Bücher-Stack)", en: "Camera setup ready (iPhone + book stack)" },
  "vc.filming.cl4": { de: "Focus-Musik an, Noise-Cancelling Kopfhörer auf", en: "Focus music on, noise-cancelling headphones on" },
  "vc.filming.cl5": { de: "Natürliche Energie — nicht übertrieben", en: "Natural energy — not over the top" },
  "vc.filming.cl6": { de: "Gefilmt (Fehler sind okay — wird geschnitten)", en: "Filmed (mistakes are okay — will be cut)" },

  // Editing Checklist
  "vc.editing.cl1": { de: "Rough Cut — alle Fehler und Stille entfernt", en: "Rough cut — all mistakes and silence removed" },
  "vc.editing.cl2": { de: "Keine Dead Space (0,5s Pausen = weg)", en: "No dead space (0.5s pauses = gone)" },
  "vc.editing.cl3": { de: "B-Roll geplant und eingefügt (1-2s pro Clip)", en: "B-Roll planned and inserted (1-2s per clip)" },
  "vc.editing.cl4": { de: "Screen Recordings für App/Process Shots", en: "Screen recordings for app/process shots" },
  "vc.editing.cl5": { de: "Auto Captions — TikTok Classic, 2 Wörter/Zeile", en: "Auto captions — TikTok Classic, 2 words/line" },
  "vc.editing.cl6": { de: "Augen nicht von Text verdeckt", en: "Eyes not covered by text" },
  "vc.editing.cl7": { de: "Musik hinzugefügt (instrumental, keine Lyrics)", en: "Music added (instrumental, no lyrics)" },
  "vc.editing.cl8": { de: "Social Proof in den ersten Sekunden", en: "Social proof in the first seconds" },
  "vc.editing.cl9": { de: "Langweilige Teile 3-5x beschleunigt", en: "Boring parts sped up 3-5x" },
  "vc.editing.cl10": { de: "Export: 4K, 30fps, kein AI Ultra HD", en: "Export: 4K, 30fps, no AI Ultra HD" },

  // Reminder Boxes
  "vc.reminder.scripting.title": { de: "Reminder", en: "Reminder" },
  "vc.reminder.scripting.text": { de: "Nicht originell sein wollen. Bewährte virale Strukturen kopieren und in deiner Nische anpassen. Besonders als Anfänger. Das Rad nicht neu erfinden.", en: "Don't try to be original. Copy proven viral structures and adapt them to your niche. Especially as a beginner. Don't reinvent the wheel." },
  "vc.reminder.editing.title": { de: "Key Insight", en: "Key Insight" },
  "vc.reminder.editing.text": { de: "5% mehr Intention pro Satz = potenziell 10x mehr Views. Kleine Retention-Unterschiede kompoundieren massiv. Jedes Visual muss einen Grund haben.", en: "5% more intention per sentence = potentially 10x more views. Small retention differences compound massively. Every visual must have a reason." },
  "vc.reminder.research.title": { de: "Worauf achten", en: "What to look for" },
  "vc.reminder.research.text": { de: "Nicht einfach scrollen. Intentional scrollen. Du suchst Outlier — Videos die für DIESEN Creator überdurchschnittlich performen. 5K+ Likes = Signal.", en: "Don't just scroll. Scroll with intent. You're looking for outliers — videos that overperform for THIS creator. 5K+ likes = signal." },
  "vc.reminder.filming.title": { de: "Wichtig", en: "Important" },
  "vc.reminder.filming.text": { de: "Du brauchst KEIN fancy Equipment. iPhone reicht. Die Energie die du mitbringst ist 100x wichtiger als die Kameraqualität. Authentisch > Perfekt.", en: "You don't need fancy equipment. iPhone is enough. The energy you bring is 100x more important than camera quality. Authentic > Perfect." },

  // Principles
  "vc.p1.title": { de: "Algorithmus = Watch Time", en: "Algorithm = Watch Time" },
  "vc.p1.desc": { de: "Nicht Hashtags, nicht Posting-Zeiten. Nur welche Videos die meiste Watch Time bekommen.", en: "Not hashtags, not posting times. Only which videos get the most watch time." },
  "vc.p2.title": { de: "Proven > Original", en: "Proven > Original" },
  "vc.p2.desc": { de: "Kopiere bewährte virale Strukturen. Versuch nicht als Anfänger originell zu sein.", en: "Copy proven viral structures. Don't try to be original as a beginner." },
  "vc.p3.title": { de: "Empathize with Viewer", en: "Empathize with Viewer" },
  "vc.p3.desc": { de: "Denk durch ihre Brille. Was würde SIE zum Wegwischen bringen?", en: "Think through their lens. What would make THEM swipe away?" },
  "vc.p4.title": { de: "Visual Simplicity", en: "Visual Simplicity" },
  "vc.p4.desc": { de: "Jeder Frame hat EINEN Fokuspunkt. Kein Clutter.", en: "Every frame has ONE focal point. No clutter." },
  "vc.p5.title": { de: "Progressive Value", en: "Progressive Value" },
  "vc.p5.desc": { de: "Jeder Satz liefert neue Info. Es wird besser, nicht schlechter.", en: "Every sentence delivers new info. It gets better, not worse." },
  "vc.p6.title": { de: "Dopamin-Hits", en: "Dopamine Hits" },
  "vc.p6.desc": { de: "Der Zuschauer fühlt sich als würde er gewinnen — nur durch Zuschauen.", en: "The viewer feels like they're winning — just by watching." },
  "vc.p7.title": { de: "Speed = Value", en: "Speed = Value" },
  "vc.p7.desc": { de: "Schnell wechselnde Visuals = Content fühlt sich wertvoller an.", en: "Fast-changing visuals = content feels more valuable." },
  "vc.p8.title": { de: "Social Proof", en: "Social Proof" },
  "vc.p8.desc": { de: "Ergebnisse früh zeigen um Glaubwürdigkeit aufzubauen.", en: "Show results early to build credibility." },
  "vc.p9.title": { de: "One Quick Win", en: "One Quick Win" },
  "vc.p9.desc": { de: "Short Form = EIN Gefühl von Verständnis. Nicht Deep Education.", en: "Short form = ONE feeling of understanding. Not deep education." },
  "vc.p10.title": { de: "5% Intentionality", en: "5% Intentionality" },
  "vc.p10.desc": { de: "Kleine Verbesserungen pro Satz = 10x mehr Views.", en: "Small improvements per sentence = 10x more views." },

  // ── Sidebar ──────────────────────────────────────────────────────────────
  "sidebar.selectClient": { de: "Client wählen", en: "Select client" },
  "sidebar.unnamed": { de: "Unbenannt", en: "Unnamed" },
  "sidebar.profile": { de: "Profil", en: "Profile" },
  "sidebar.scripts": { de: "Skripte", en: "Scripts" },
  "sidebar.strategy": { de: "Strategie", en: "Strategy" },
  "sidebar.ideas": { de: "Ideen", en: "Ideas" },
  "sidebar.chat": { de: "Chat", en: "Chat" },
  "sidebar.competitorAnalysis": { de: "Konkurrenz-Analyse", en: "Competitor Analysis" },
  "sidebar.dashboard": { de: "Dashboard", en: "Dashboard" },
  "sidebar.impersonate": { de: "Als {{name}} ansehen", en: "View as {{name}}" },
  "sidebar.delete": { de: "Löschen", en: "Delete" },
  "sidebar.noClients": { de: "Noch keine Clients", en: "No clients yet" },
  "sidebar.createNewClient": { de: "Neuen Client anlegen", en: "Create new client" },
  "sidebar.sectionClient": { de: "Client", en: "Client" },
  "sidebar.adminConsole": { de: "Admin Konsole", en: "Admin Console" },
  "sidebar.impersonateFailed": { de: "Impersonate fehlgeschlagen", en: "Impersonate failed" },
  "sidebar.confirmDelete": { de: "\"{{name}}\" wirklich löschen?", en: "Really delete \"{{name}}\"?" },
  "sidebar.contentAgent": { de: "Content Agent", en: "Content Agent" },
  "sidebar.carousel": { de: "Karussell", en: "Carousel" },
  "sidebar.globalAudit": { de: "Globales Audit", en: "Global Audit" },
  "sidebar.training": { de: "Training", en: "Training" },
  "sidebar.transcribe": { de: "Transkribieren", en: "Transcribe" },

  // ── Command Palette ──────────────────────────────────────────────────────
  "cmdk.openDashboard": { de: "Dashboard öffnen", en: "Open dashboard" },
  "cmdk.forClient": { de: "Für {{name}}", en: "For {{name}}" },
  "cmdk.admin": { de: "Admin", en: "Admin" },
  "cmdk.toAdminConsole": { de: "Zur Admin Konsole", en: "Go to Admin Console" },
  "cmdk.placeholder": { de: "Springe zu Client, Seite oder Tool...", en: "Jump to client, page or tool..." },
  "cmdk.noResults": { de: "Nichts gefunden", en: "Nothing found" },
  "cmdk.groupClients": { de: "Clients", en: "Clients" },
  "cmdk.groupCurrentClient": { de: "Aktueller Client", en: "Current Client" },
  "cmdk.groupAdminTools": { de: "Admin & Tools", en: "Admin & Tools" },
  "cmdk.select": { de: "wählen", en: "select" },
  "cmdk.open": { de: "öffnen", en: "open" },

  // ── Portal Dashboard ─────────────────────────────────────────────────────
  "portal.dash.loading": { de: "Laden...", en: "Loading..." },
  "portal.dash.welcome": { de: "Willkommen", en: "Welcome" },
  "portal.dash.subtitle": { de: "Dein Content-Dashboard", en: "Your content dashboard" },
  "portal.dash.scripts": { de: "Skripte", en: "Scripts" },
  "portal.dash.scriptCount": { de: "{{count}} Skripte erstellt", en: "{{count}} scripts created" },
  "portal.dash.strategy": { de: "Strategie", en: "Strategy" },
  "portal.dash.strategyDesc": { de: "Content-Strategie & Wochenplan", en: "Content strategy & weekly plan" },
  "portal.dash.audit": { de: "Audit", en: "Audit" },
  "portal.dash.auditAvailable": { de: "Audit verfügbar", en: "Audit available" },
  "portal.dash.noAudit": { de: "Noch kein Audit", en: "No audit yet" },
  "portal.dash.videos": { de: "Videos", en: "Videos" },
  "portal.dash.videoCount": { de: "Analysierte Videos", en: "Analyzed videos" },

  // ── Portal Scripts ───────────────────────────────────────────────────────
  "portal.scripts.empty": { de: "Noch keine Skripte vorhanden.", en: "No scripts yet." },
  "portal.scripts.untitled": { de: "Ohne Titel", en: "Untitled" },
  "portal.scripts.hook": { de: "Hook", en: "Hook" },
  "portal.scripts.body": { de: "Body", en: "Body" },
  "portal.scripts.cta": { de: "CTA", en: "CTA" },
  "portal.scripts.copied": { de: "Kopiert", en: "Copied" },
  "portal.scripts.copy": { de: "Skript kopieren", en: "Copy script" },

  // ── Portal Strategy ──────────────────────────────────────────────────────
  "portal.strategy.empty": { de: "Noch keine Strategie erstellt.", en: "No strategy created yet." },
  "portal.strategy.goal": { de: "Strategisches Ziel", en: "Strategic Goal" },
  "portal.strategy.pillars": { de: "Content-Pillars", en: "Content Pillars" },
  "portal.strategy.weeklyPlan": { de: "Wochenplan", en: "Weekly Plan" },

  // ── Portal Audit ─────────────────────────────────────────────────────────
  "portal.audit.empty": { de: "Noch kein Audit vorhanden.", en: "No audit yet." },
  "portal.audit.report": { de: "Audit-Bericht", en: "Audit Report" },
  "portal.audit.createdAt": { de: "Erstellt: {{date}}", en: "Created: {{date}}" },
  "portal.audit.followers": { de: "Follower", en: "Followers" },
  "portal.audit.reels30d": { de: "Reels (30d)", en: "Reels (30d)" },
  "portal.audit.avgViews30d": { de: "⌀ Views (30d)", en: "⌀ Views (30d)" },

  // ── Portal Ideas / Videos / Shell ────────────────────────────────────────
  "portal.ideas.empty": { de: "Noch keine Ideen. Starte ein Voice-Interview oder nutze den Chat.", en: "No ideas yet. Start a voice interview or use the chat." },
  "portal.videos.empty": { de: "Noch keine Videos analysiert.", en: "No videos analyzed yet." },
  "portal.shell.noData": { de: "Noch keine Daten vorhanden.", en: "No data available." },
  "portal.shell.loading": { de: "Laden...", en: "Loading..." },

  // ── Portal Chat ──────────────────────────────────────────────────────────
  "portal.chat.suggestion1": { de: "Schreib mir ein Skript", en: "Write me a script" },
  "portal.chat.suggestion2": { de: "Was sagt mein Audit?", en: "What does my audit say?" },
  "portal.chat.suggestion3": { de: "Welche Hooks performen gut?", en: "Which hooks perform well?" },
  "portal.chat.suggestion4": { de: "Was machen meine Konkurrenten?", en: "What are my competitors doing?" },
  "portal.chat.emptySubtitle": { de: "Frag mich alles zu deinem Content, lass Skripte generieren oder check deine Performance. Du kannst auch PDFs oder Bilder anhängen.", en: "Ask me anything about your content, generate scripts or check your performance. You can also attach PDFs or images." },

  // ── Content Agent Chat (admin + portal shared) ───────────────────────────
  "chat.title": { de: "Content Agent", en: "Content Agent" },
  "chat.clearHistory": { de: "Chat leeren", en: "Clear chat" },
  "chat.emptyTitle": { de: "Chat über {{name}}", en: "Chat about {{name}}" },
  "chat.emptyTitleDefault": { de: "Wie kann ich dir helfen?", en: "How can I help?" },
  "chat.emptySubtitle": { de: "Ich habe Zugriff auf Kontext, Audit, Performance & Skripte. Du kannst auch PDFs oder Bilder anhängen.", en: "I have access to context, audit, performance & scripts. You can also attach PDFs or images." },
  "chat.placeholder": { de: "Frag mich etwas...", en: "Ask me something..." },
  "chat.placeholderChat": { de: "Nachricht schreiben...", en: "Write a message..." },
  "chat.errorMsg": { de: "*Fehler: {{error}}*", en: "*Error: {{error}}*" },
  "chat.connectionError": { de: "*Verbindungsfehler. Bitte nochmal versuchen.*", en: "*Connection error. Please try again.*" },
  "chat.tools.listClients": { de: "Lade Client-Liste", en: "Loading client list" },
  "chat.tools.loadClientContext": { de: "Lade Client-Profil", en: "Loading client profile" },
  "chat.tools.loadVoiceProfile": { de: "Lade Voice Profile", en: "Loading voice profile" },
  "chat.tools.searchScripts": { de: "Suche Skripte", en: "Searching scripts" },
  "chat.tools.checkPerformance": { de: "Prüfe Performance", en: "Checking performance" },
  "chat.tools.loadAudit": { de: "Lade Audit", en: "Loading audit" },
  "chat.tools.generateScript": { de: "Generiere Skript", en: "Generating script" },
  "chat.tools.checkCompetitors": { de: "Analysiere Wettbewerber", en: "Analyzing competitors" },
  "chat.tools.checkLearnings": { de: "Lade Learnings", en: "Loading learnings" },
  "chat.tools.searchWeb": { de: "Web-Recherche", en: "Web research" },
  "chat.tools.researchTrends": { de: "Trend-Research", en: "Trend research" },
  "chat.tools.saveIdea": { de: "Speichere Idee", en: "Saving idea" },
  "chat.tools.updateProfile": { de: "Aktualisiere Profil", en: "Updating profile" },

  // ── Voice Agent ──────────────────────────────────────────────────────────
  "voice.you": { de: "Du", en: "You" },
  "voice.clientRole": { de: "Client", en: "Client" },
  "voice.agentName": { de: "SUNXCA Agent", en: "SUNXCA Agent" },
  "voice.agentRole": { de: "KI-Interviewer", en: "AI Interviewer" },
  "voice.statusReady": { de: "Bereit", en: "Ready" },
  "voice.statusConnecting": { de: "Verbinde...", en: "Connecting..." },
  "voice.statusPrep": { de: "Lade Kontext...", en: "Loading context..." },
  "voice.statusEnding": { de: "Wird beendet...", en: "Ending..." },
  "voice.statusDone": { de: "Beendet", en: "Done" },
  "voice.statusActive": { de: "Verbunden", en: "Connected" },
  "voice.startButton": { de: "Interview starten", en: "Start interview" },
  "voice.connectingMsg": { de: "Verbinde mit Agent...", en: "Connecting to agent..." },
  "voice.loadingMsg": { de: "Lade deinen Kontext...", en: "Loading your context..." },
  "voice.buildingSession": { de: "Session wird aufgebaut.", en: "Setting up session." },
  "voice.preloadingContext": { de: "Client-Profil, Audit, Performance werden vorgeladen. Der Agent begrüßt dich gleich.", en: "Client profile, audit, performance are being preloaded. The agent will greet you shortly." },
  "voice.endButton": { de: "Interview beenden", en: "End interview" },
  "voice.summarizing": { de: "Wird zusammengefasst...", en: "Summarizing..." },
  "voice.notLoggedIn": { de: "Nicht eingeloggt", en: "Not logged in" },
  "voice.unauthorized": { de: "Nicht autorisiert", en: "Not authorized" },
  "voice.connectionFailed": { de: "Verbindung zum Voice-Server fehlgeschlagen", en: "Voice server connection failed" },
  "voice.serverNotRunning": { de: "Verbindung zum Voice Server fehlgeschlagen. Läuft der Server? (npm run voice-server)", en: "Voice server connection failed. Is the server running? (npm run voice-server)" },
  "voice.startError": { de: "Fehler beim Starten", en: "Error starting" },
  "voice.sessionComplete": { de: "Session abgeschlossen", en: "Session complete" },
  "voice.duration": { de: "{{minutes}} Min. Gespräch", en: "{{minutes}} min conversation" },
  "voice.ideasSaved": { de: "{{count}} Ideen gespeichert", en: "{{count}} ideas saved" },
  "voice.savedIdeas": { de: "Gespeicherte Content-Ideen", en: "Saved content ideas" },
  "voice.showTranscript": { de: "Transkript anzeigen ({{count}} Nachrichten)", en: "Show transcript ({{count}} messages)" },
  "voice.youLabel": { de: "Du:", en: "You:" },
  "voice.agentLabel": { de: "Agent:", en: "Agent:" },
  "voice.restartButton": { de: "Neues Interview starten", en: "Start new interview" },
  // Onboarding-specific
  "voice.pauseButton": { de: "Später weitermachen", en: "Finish later" },
  "voice.progressLabel": { de: "{{done}} von {{total}} Blöcken", en: "{{done}} of {{total}} blocks" },
  "voice.block.identity": { de: "Identität", en: "Identity" },
  "voice.block.positioning": { de: "Positionierung", en: "Positioning" },
  "voice.block.audience": { de: "Zielgruppe", en: "Audience" },
  "voice.block.beliefs": { de: "Beliefs", en: "Beliefs" },
  "voice.block.offer": { de: "Angebot", en: "Offer" },
  "voice.block.feel": { de: "Content-Feel", en: "Content feel" },
  "voice.block.vision": { de: "Vision", en: "Vision" },
  "voice.block.resources": { de: "Ressourcen", en: "Resources" },
  "voice.onboardingComplete": { de: "Onboarding abgeschlossen", en: "Onboarding complete" },
  "voice.onboardingPartial": { de: "{{done}} von {{total}} Blöcken gespeichert. Du kannst jederzeit im Profil weitermachen.", en: "{{done}} of {{total}} blocks saved. You can continue any time from your profile." },
  "voice.blocksSaved": { de: "Blöcke erfasst", en: "Blocks captured" },
  // Field suggestions (extracted from voice interview)
  "voice.fieldSuggestionsTitle": { de: "Vorschläge fürs Profil", en: "Suggestions for your profile" },
  "voice.fieldSuggestionsHint": { de: "Das habe ich aus dem Gespräch rausgehört. Wähle aus, was du in dein Profil übernehmen willst.", en: "Here's what I picked up from the conversation. Select what you want to apply to your profile." },
  "voice.selectAll": { de: "Alle wählen", en: "Select all" },
  "voice.deselectAll": { de: "Keine", en: "Deselect all" },
  "voice.applySelected": { de: "{{count}} übernehmen", en: "Apply {{count}}" },
  "voice.applying": { de: "Wird übernommen...", en: "Applying..." },
  "voice.applied": { de: "Übernommen", en: "Applied" },
  "voice.applyError": { de: "Fehler beim Speichern", en: "Save failed" },
};

type Substitutions = Record<string, string | number>;

interface I18nContextType {
  lang: Lang;
  toggleLang: () => void;
  setClientLang: (lang: Lang) => void;
  t: (key: string, subs?: Substitutions) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "de",
  toggleLang: () => {},
  setClientLang: () => {},
  t: (key: string) => key,
});

function applySubs(text: string, subs?: Substitutions): string {
  if (!subs) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
    const v = subs[key];
    return v === undefined || v === null ? `{{${key}}}` : String(v);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("de");

  // Read from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const stored = localStorage.getItem("sunxca-lang") as Lang | null;
    if (stored && stored !== lang) setLang(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "de" ? "en" : "de";
      localStorage.setItem("sunxca-lang", next);
      return next;
    });
  }, []);

  // Precedence: user override (localStorage) > client default > "de".
  // Only applies client default when user hasn't explicitly set a language.
  const setClientLang = useCallback((clientLang: Lang) => {
    const stored = localStorage.getItem("sunxca-lang") as Lang | null;
    if (!stored) setLang(clientLang);
  }, []);

  const t = useCallback(
    (key: string, subs?: Substitutions) => {
      const entry = translations[key];
      if (!entry) return key;
      return applySubs(entry[lang], subs);
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, toggleLang, setClientLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
