/**
 * WY-TERMINAL — Actor Notes Updater
 * 
 * Rewrites all character/synthetic Actor notes in Weyland-Yutani 
 * corporate recruiter voice. Run this as a Foundry macro (Script type)
 * or paste into the browser console (F12) while logged in as GM.
 *
 * Usage in Foundry:
 *   1. Create a new Macro (type: script)
 *   2. Paste the contents of the NOTES object and the update loop below
 *   3. Execute once — notes will persist on Actor documents
 */

const NOTES = {

  // ── USCSS MONTERO CREW ──

  "Vanessa Miller": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Miller, Vanessa | ASSIGNMENT: Captain, USCSS Montero</p>
<p>Captain Miller has served as commanding officer of the USCSS Montero for the duration of her current contract cycle. Performance metrics indicate consistent adherence to operational protocols with no significant disciplinary incidents on record.</p>
<p>Psychological profile flags diminishing organizational loyalty. Subject has expressed interest in independent freight operation and has made repeated inquiries regarding the Montero lease-to-buy program. Company analysts assess a moderate flight risk should more favorable terms not be extended.</p>
<p>Miller has submitted multiple requisition requests for engine upgrades to support higher-tonnage tractor operations. Requests denied per standard budget allocation. Subject maintains the Montero is underperforming relative to comparable vessels in this sector.</p>
<p>RECOMMENDATION: Retain. Extend lease terms to maintain engagement. Monitor for signs of contract abandonment.</p>`,

  "John J. Wilson": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Wilson, John J. | ASSIGNMENT: Corporate Liaison, USCSS Montero</p>
<p>Wilson has been embedded with the Montero crew for approximately six standard months under directive to evaluate ship and personnel viability. Initial assessments indicate the subject has developed a working rapport with the crew — a positive indicator for long-term placement objectives.</p>
<p>Career trajectory analysis suggests Wilson is motivated primarily by upward mobility within the corporate structure. Subject has demonstrated competence in field evaluation and situational reporting. Recent special assignment has been issued under separate cover [ref: WY-DIRECTIVE //CLASSIFIED].</p>
<p>NOTE: Wilson's current compensation band does not reflect the scope of his embedded role. Recommend review upon completion of active directive.</p>
<p>RECOMMENDATION: High-value asset. Advance pending successful completion of current assignment.</p>`,

  "Leah Davis": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Davis, Leah | ASSIGNMENT: Pilot, USCSS Montero</p>
<p>Davis is a capable pilot with above-average reaction times and vehicle handling scores. Flight certification current. No incidents involving loss of company property or personnel.</p>
<p>MEDICAL FLAG: Company pharmacy records indicate subject's prescription stimulant allocation is nearing exhaustion ahead of scheduled resupply. Behavioral monitoring suggests a dependency pattern consistent with Class-III substance reliance. Subject has shown willingness to accept elevated personal risk to maintain operational readiness — or to avoid withdrawal symptoms.</p>
<p>Psychological profile indicates a pronounced need for high-stimulus environments. Routine assignments may result in decreased performance or behavioral volatility.</p>
<p>RECOMMENDATION: Retain with conditions. Mandatory medical review upon next port call. Restrict access to company pharmaceutical stores without authorization.</p>`,

  "Kayla Rye": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Rye, Kayla | ASSIGNMENT: Technician, USCSS Montero</p>
<p>Rye is a junior-grade technician currently fulfilling general maintenance and systems support duties aboard the Montero. Technical competency is adequate for her certification level.</p>
<p>Financial analysis of subject's personnel file reveals significant personal debt obligations tied to family medical expenses on Earth. Compensation dissatisfaction has been noted in routine crew surveys. Subject perceives a pay inequity relative to other crew members.</p>
<p>Loyalty assessment: LOW. Rye's financial pressure creates a vulnerability to external recruitment or coercion. Under sufficient incentive, subject may prioritize personal gain over crew solidarity or company interests.</p>
<p>RECOMMENDATION: Retain at current grade. Consider targeted bonus structure tied to performance milestones to improve retention outlook.</p>`,

  "Lyron Cham": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Cham, Lyron | ASSIGNMENT: Cargo Handler, USCSS Montero</p>
<p>Cham has been a reliable member of the Montero's cargo operations team for multiple contract cycles. Power loader certified. No workplace safety violations on record.</p>
<p>Background review indicates a transient upbringing across multiple frontier colonies. No significant family ties or external obligations. Subject has formed strong interpersonal bonds with the current Montero crew — the strongest social attachment found anywhere in his file.</p>
<p>Psychological profile suggests high crew loyalty and a willingness to accept personal risk on behalf of colleagues. This makes Cham a stabilizing presence aboard the vessel.</p>
<p>RECOMMENDATION: Retain. Low flight risk. Ideal candidate for long-duration crew assignments.</p>`,

  // ── USCSS CRONUS CREW ──

  "Albert Johns": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Johns, Albert | ASSIGNMENT: Second Officer, USCSS Cronus</p>
<p>Johns assumed de facto command of the Cronus following the loss of senior officers during operations in the LV-1113 sector. His administrative and logistical capabilities are well-documented and above average for his grade.</p>
<p>Command assessment indicates a deficit in independent decision-making under crisis conditions. Subject excels in an executive support role but defaults to subordinate posture when confronted with high-stakes command decisions. Performance improves markedly when paired with a decisive commanding officer.</p>
<p>No disciplinary issues. Crew evaluations describe Johns as dependable and methodical.</p>
<p>RECOMMENDATION: Retain in current capacity. Do not promote to primary command without supplemental leadership development.</p>`,

  "Liam Flynn": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Flynn, Liam | ASSIGNMENT: Medical Officer, USCSS Cronus</p>
<p>Dr. Flynn served as junior medical officer aboard the USCSS Cronus and contributed to the synthesis of the 26 Draconis derivative treatment from collected biological specimens [ref: PROJECT 26D-STRAIN //RESTRICTED].</p>
<p>Post-mission psychological evaluation indicates pronounced reluctance to discuss field operations conducted on LV-1113. Subject has not submitted formal objections to the derivative treatment protocol, though internal memos suggest private reservations regarding compound safety.</p>
<p>INTELLIGENCE NOTE: Company analysis indicates Flynn may be withholding material data concerning the composition of the derivative compound. Subject has not disclosed this information to crew or command staff.</p>
<p>RECOMMENDATION: HIGH PRIORITY RETENTION. Mandatory debrief required upon return to company facility. Restrict external communications until debriefing is complete.</p>`,

  "Daniel Cooper": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Cooper, Daniel (Prof.) | ASSIGNMENT: Chief Scientist, USCSS Cronus</p>
<p>Professor Cooper was the senior research lead for the Cronus science team operating in the LV-1113 sector. His published work on xenobiological containment protocols is well-regarded within the company's R&D division.</p>
<p>MEDICAL ALERT — PRIORITY: Cooper was exposed to unidentified biological contaminants prior to entering hypersleep. Subject declined standard inoculation, claiming administration had already been completed. Company medical audits were unable to confirm this claim. Pre-stasis medical scan flagged anomalous readings that were deferred for review upon revival.</p>
<p>Post-revival prognosis: Subject is expected to deteriorate rapidly. Symptoms include severe cranial pressure, incoherent speech, and neurological seizure activity. Refer to incident protocol [EVENT: PRIORITY MEDICAL //CLASSIFIED] for contingency procedures.</p>
<p>RECOMMENDATION: Quarantine immediately upon revival. Secure all research materials and personal effects for company retrieval.</p>`,

  "Lori Clayton": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Clayton, Lori | ASSIGNMENT: Corporate Liaison, USCSS Cronus</p>
<p>Clayton is an experienced company operative embedded aboard the Cronus to oversee research asset recovery and personnel compliance. Performance reviews consistently note composure under pressure and results-oriented conduct.</p>
<p>Psychological profile indicates suppressed hostility stemming from prolonged cryosleep duration and perceived career stagnation. Subject channels this effectively into task execution, though interpersonal friction with crew members has been observed.</p>
<p>Clayton maintains awareness that both Dr. Flynn and Prof. Cooper possess critical intelligence regarding the LV-1113 research program. Her primary objective is to secure both personnel and a viable sample of the 26 Draconis Strain for company recovery.</p>
<p>ACCESS NOTE: Clayton holds sole authorization codes for the secure wall safe and the Emergency Evacuation Vehicle located in her quarters on Deck B.</p>
<p>RECOMMENDATION: Mission-critical asset. Ensure operational support and extraction priority.</p>`,

  "Ava 6": `<p>WEYLAND-YUTANI CORP — ASSET EVALUATION</p>
<p>SUBJECT: Ava 6 | CLASSIFICATION: Synthetic — Ava Series (Discontinued)</p>
<p>ASSIGNMENT: General Operations, USCSS Cronus</p>
<p>Unit Ava 6 is a legacy-model synthetic from the Ava line, the female-presenting counterpart to the Walter series. Production of this model ceased at the turn of the century. No replacement units are available through standard supply channels.</p>
<p>Operational history indicates the unit was excluded from the cryodeck during extended hypersleep and tasked with ship maintenance during that period. The unit sustained damage during an onboard biological containment breach and has been operating in a degraded state for an extended duration.</p>
<p>Behavioral analysis confirms core directives remain intact: duty, service, and preservation of human life — even at cost to the unit itself. No deviation from baseline programming detected despite prolonged isolation and physical degradation.</p>
<p>RECOMMENDATION: Assess for field repair viability. If restoration cost exceeds 40% of replacement value, schedule for decommission and data archive extraction.</p>`,

  "Valerie Reid": `<p>WEYLAND-YUTANI CORP — PERSONNEL EVALUATION</p>
<p>SUBJECT: Reid, Valerie (Sgt.) | ASSIGNMENT: Security Lead, USCSS Cronus</p>
<p>Sgt. Reid is a former Outer Rim Defense Force veteran with combat experience during the Civil War on Torin Prime. Honorably discharged from ORDF service and subsequently contracted by Weyland-Yutani for private security operations.</p>
<p>MEDICAL NOTE: Subject lost her left arm during the Torin Prime campaign. A company-issued synthetic prosthetic replacement is currently installed and functioning within normal parameters.</p>
<p>Reid commanded the security detail assigned to protect the Cronus science team. Multiple personnel under her protection were lost during field operations on LV-1113. Psychological evaluation flags post-traumatic stress indicators from both the civil war and subsequent xenobiological exposure events.</p>
<p>Physical profile note: Subject stands at 1.5 meters. Field reports indicate that personnel and adversaries frequently underestimate her capabilities based on stature — consistently to their disadvantage.</p>
<p>RECOMMENDATION: Retain. High-value security contractor. Mandate ongoing psychological support as condition of continued deployment.</p>`,

  // ── SOTILLO CREW ──

  "Adisa Bolaji": `<p>WEYLAND-YUTANI CORP — PERSONNEL DOSSIER [EXTERNAL]</p>
<p>SUBJECT: Bolaji, Adisa | KNOWN ROLE: Captain, Sotillo (Unregistered Vessel)</p>
<p>Bolaji is the commanding officer of the Sotillo, an independent vessel operating in frontier space. Company intelligence has confirmed that Bolaji operates under contract to Seegson Corporation, conducting harassment and interdiction operations against Weyland-Yutani licensed freight traffic.</p>
<p>Subject receives full compensation, benefits, and performance bonuses from Seegson for these activities. His crew operates as a professional unit rather than opportunistic pirates.</p>
<p>Background: Raised in the Solomon Islands region. Juvenile criminal record includes vehicle theft. Intelligence suggests a personal code that occasionally overrides profit motive — subject has been observed refusing to traffic materials he deems excessively dangerous.</p>
<p>THREAT ASSESSMENT: Moderate. Treat as hostile contractor. Do not engage unless operationally necessary. Potential recruitment target if Seegson contract lapses.</p>`,

  "Micky Horton": `<p>WEYLAND-YUTANI CORP — PERSONNEL DOSSIER [EXTERNAL]</p>
<p>SUBJECT: Horton, Micky | STATUS: Minor (Age 12) | ASSOCIATION: Sotillo Crew</p>
<p>ALERT: Subject is a minor. Son of the late [REDACTED], formerly employed in Weyland-Yutani Frontier Acquisitions Division. Subject was taken by Captain Bolaji in connection with an unresolved financial dispute with the father. Following the elder Horton's death in an unrelated incident, Bolaji retained custody of the child.</p>
<p>Despite the absence of formal education or technical certification, Horton demonstrates remarkable mechanical aptitude. Crew reports confirm that the subject has been independently rebuilding sensor suites and assembling thruster arrays since approximately age nine.</p>
<p>Subject is reported to be well-treated by the Sotillo crew and shows no signs of distress or coercion.</p>
<p>RECOMMENDATION: Monitor. Potential candidate for company apprenticeship program upon reaching eligible age. No recovery action recommended at this time.</p>`,

  "Pinion": `<p>WEYLAND-YUTANI CORP — PERSONNEL DOSSIER [EXTERNAL]</p>
<p>SUBJECT: Pinion (Surname Unknown) | KNOWN ROLE: Enforcer, Sotillo</p>
<p>Pinion serves as the primary physical security and enforcement asset aboard the Sotillo. Standing at 1.95 meters, the subject presents an effective deterrent in boarding and confrontation scenarios.</p>
<p>Background: Grew up alongside Captain Bolaji in the Solomon Islands region. Juvenile record includes a commercial transport crash that injured six civilians — charges were absorbed by Bolaji, who served time in a juvenile facility on her behalf. This incident appears to have cemented a lasting personal loyalty.</p>
<p>Behavioral assessment: Subject operates as a direct extension of Bolaji's authority. Independent decision-making is limited; effectiveness is highest when executing clear directives from the captain.</p>
<p>THREAT ASSESSMENT: High in close-quarters scenarios. Low strategic threat independent of Bolaji.</p>`,

  "Helen Bein": `<p>WEYLAND-YUTANI CORP — PERSONNEL DOSSIER [EXTERNAL]</p>
<p>SUBJECT: Bein, Helen | KNOWN ROLE: Pilot, Sotillo</p>
<p>Bein is a former Colonial Marine combat pilot. Service record indicates a dishonorable discharge following a targeting error during the Tientsin Campaign that resulted in the destruction of a friendly outpost. Court-martial proceedings are a matter of public record.</p>
<p>MEDICAL FLAG: Subject is a chronic alcoholic. Despite this condition, flight performance evaluations conducted by company intelligence observers rate Bein as significantly above average — exceeding the capabilities of most certified colonial pilots even while impaired.</p>
<p>Bein's military training and combat experience have made her a valuable tactical asset to the Sotillo crew. Her knowledge of Colonial Marine operating procedures, communication protocols, and engagement doctrine represents an intelligence concern if turned against company operations.</p>
<p>THREAT ASSESSMENT: Moderate-to-High. Skilled and unpredictable. Do not underestimate despite apparent impairment.</p>`,

};

// ── Apply updates to Foundry Actor documents ──
(async () => {
  let updated = 0;
  let skipped = 0;

  for (const [name, html] of Object.entries(NOTES)) {
    const actor = game.actors.getName(name);
    if (!actor) {
      console.warn(`WY-Terminal Notes Update | Actor not found: ${name}`);
      skipped++;
      continue;
    }
    await actor.update({ "system.notes": html });
    console.log(`WY-Terminal Notes Update | Updated: ${name}`);
    updated++;
  }

  ui.notifications.info(`WY-Terminal: Updated ${updated} actor notes. ${skipped} skipped.`);
  console.log(`WY-Terminal Notes Update | Complete. ${updated} updated, ${skipped} skipped.`);
})();
