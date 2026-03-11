"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Lang = "de" | "en";

const translations: Record<string, { de: string; en: string }> = {
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
  "strategy.scrapingProfile": { de: "Instagram-Profil wird gescrapt…", en: "Scraping Instagram profile…" },
  "strategy.downloadingVideos": { de: "Top-Videos werden heruntergeladen & bei Gemini hochgeladen…", en: "Downloading top videos & uploading to Gemini…" },
  "strategy.analyzingHooks": { de: "Hooks, Scripts und Performance werden analysiert…", en: "Analyzing hooks, scripts, and performance…" },
  "strategy.analysisDuration": { de: "Das dauert 1–3 Minuten.", en: "This takes 1–3 minutes." },
  "strategy.noAnalysis": { de: "Noch keine Analyse vorhanden.", en: "No analysis yet." },
  "strategy.analyzeHint": { de: "Analysieren klicken, um das Instagram-Profil zu scrapen und herauszufinden, was funktioniert.", en: "Click Analyze to scrape the Instagram profile and find out what works." },
  "strategy.topLast30": { de: "Top — Letzte 30 Tage", en: "Top — Last 30 Days" },
  "strategy.topLast": { de: "Top — Letzte", en: "Top — Last" },
  "strategy.excludingLast30": { de: "(ohne letzte 30)", en: "(excluding last 30)" },
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
  "creators.autoScrape": { de: "Profilbild, Follower und Aktivitätsdaten werden automatisch gescrapt.", en: "Profile picture, followers, and activity data will be scraped automatically." },
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
  "creators.profileHint": { de: "Klick auf @username öffnet das Instagram-Profil zur Prüfung. Nach dem Hinzufügen werden Follower-Zahlen automatisch per Apify abgerufen.", en: "Click @username to open the Instagram profile for review. After adding, follower counts are fetched automatically via Apify." },
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
  "creators.clickScrape": { de: "klicken zum Scrapen", en: "click to scrape" },
  "creators.scraped": { de: "Gescrapt", en: "Scraped" },
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
  "transcribe.igLoading": { de: "Reel wird über Apify geladen und bei Gemini hochgeladen…", en: "Reel is being loaded via Apify and uploaded to Gemini…" },
  "transcribe.ytLoading": { de: "YouTube-Video wird mit Gemini verarbeitet…", en: "YouTube video is being processed with Gemini…" },
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

  // Scripts Page extras
  "scripts.regenerate": { de: "Neu generieren", en: "Regenerate" },
  "scripts.saved": { de: "Gespeichert", en: "Saved" },
  "scripts.save": { de: "Speichern", en: "Save" },
  "scripts.ownVideos": { de: "eigene Videos", en: "own videos" },
  "scripts.noOwnAnalysis": { de: "Keine eigene Analyse", en: "No own analysis" },
  "scripts.creatorVideos": { de: "Creator-Videos", en: "Creator videos" },
  "scripts.noCreatorVideos": { de: "Keine Creator-Videos", en: "No creator videos" },
  "scripts.12months": { de: "12 Monate", en: "12 months" },
};

interface I18nContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "de",
  toggleLang: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("de");

  // Read from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const stored = localStorage.getItem("sunxca-lang") as Lang | null;
    if (stored && stored !== lang) setLang(stored);
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "de" ? "en" : "de";
      localStorage.setItem("sunxca-lang", next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang];
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
