package com.dactor.patient.util

import com.dactor.patient.data.model.Clinic
import com.dactor.patient.data.model.Doctor
import com.dactor.patient.data.model.ClinicService
import java.util.Locale

data class SearchMatchResult(
    val isMatch: Boolean,
    val score: Int = 0,
    val matchedDoctors: List<Doctor> = emptyList(),
    val matchHighlightReason: String? = null
)

object MedicalSearchEngine {

    // Layman symptom, organ, and condition mapping to medical specialty stems
    private val synonymMap: Map<String, List<String>> = mapOf(
        // Dermatology / Skin
        "skin" to listOf("dermatol", "skin", "cosmetol", "venereol", "derma"),
        "acne" to listOf("dermatol", "skin", "cosmetol"),
        "pimple" to listOf("dermatol", "skin"),
        "pimples" to listOf("dermatol", "skin"),
        "rash" to listOf("dermatol", "skin", "allergy"),
        "rashes" to listOf("dermatol", "skin", "allergy"),
        "allergy" to listOf("dermatol", "allergy", "immunol", "pulmon"),
        "hair" to listOf("dermatol", "trichol", "hair"),
        "scalp" to listOf("dermatol", "skin"),
        "eczema" to listOf("dermatol", "skin"),
        "dermatology" to listOf("dermatol", "skin"),
        "dermatologist" to listOf("dermatol", "skin"),

        // Cardiology / Heart
        "heart" to listOf("cardio", "heart", "internal medicine"),
        "cardiac" to listOf("cardio", "heart"),
        "chest pain" to listOf("cardio", "pulmon", "internal medicine"),
        "bp" to listOf("cardio", "internal medicine", "physician"),
        "hypertension" to listOf("cardio", "internal medicine"),
        "blood pressure" to listOf("cardio", "internal medicine"),
        "cardiologist" to listOf("cardio", "heart"),
        "cardiology" to listOf("cardio", "heart"),

        // Orthopedics / Bone & Joints
        "bone" to listOf("ortho", "bone", "joint", "physiotherap"),
        "bones" to listOf("ortho", "bone", "joint"),
        "joint" to listOf("ortho", "rheumatol", "joint"),
        "joints" to listOf("ortho", "rheumatol"),
        "fracture" to listOf("ortho", "trauma", "bone"),
        "knee" to listOf("ortho", "joint", "physiotherap"),
        "spine" to listOf("ortho", "neuro", "spine"),
        "back pain" to listOf("ortho", "physiotherap", "spine"),
        "arthritis" to listOf("ortho", "rheumatol"),
        "ligament" to listOf("ortho", "sports medicine"),
        "orthopedic" to listOf("ortho", "bone"),
        "orthopedics" to listOf("ortho", "bone"),
        "orthopedician" to listOf("ortho", "bone"),

        // Ophthalmology / Eye
        "eye" to listOf("ophthalm", "eye", "optom", "vision"),
        "eyes" to listOf("ophthalm", "eye", "optom"),
        "vision" to listOf("ophthalm", "eye", "optom"),
        "cataract" to listOf("ophthalm", "eye"),
        "glasses" to listOf("optom", "ophthalm", "eye"),
        "spectacle" to listOf("optom", "ophthalm"),
        "retina" to listOf("ophthalm", "retina"),
        "ophthalmologist" to listOf("ophthalm", "eye"),
        "ophthalmology" to listOf("ophthalm", "eye"),

        // Dental
        "tooth" to listOf("dent", "oral", "maxillofac"),
        "teeth" to listOf("dent", "oral"),
        "dental" to listOf("dent", "oral"),
        "dentist" to listOf("dent", "oral"),
        "gum" to listOf("dent", "periodont"),
        "cavity" to listOf("dent", "oral"),
        "root canal" to listOf("dent", "endodont"),
        "braces" to listOf("dent", "orthodont"),

        // Pediatrics / Child
        "child" to listOf("pediatr", "child", "neonat"),
        "children" to listOf("pediatr", "child"),
        "baby" to listOf("pediatr", "neonat", "child"),
        "kid" to listOf("pediatr", "child"),
        "kids" to listOf("pediatr", "child"),
        "infant" to listOf("pediatr", "neonat"),
        "newborn" to listOf("neonat", "pediatr"),
        "vaccine" to listOf("pediatr", "immuniz", "general"),
        "vaccination" to listOf("pediatr", "immuniz", "general"),
        "pediatrician" to listOf("pediatr", "child"),
        "pediatrics" to listOf("pediatr", "child"),

        // ENT
        "ear" to listOf("ent", "otolaryng", "ear"),
        "nose" to listOf("ent", "rhinol", "nose"),
        "throat" to listOf("ent", "laryngol", "throat"),
        "ent" to listOf("ent", "otolaryng", "ear", "nose", "throat"),
        "sinus" to listOf("ent", "rhinol"),
        "hearing" to listOf("ent", "audiol"),
        "tonsil" to listOf("ent", "throat"),

        // Gynecology & Obstetrics
        "women" to listOf("gynec", "obstetr", "obgyn", "women"),
        "female" to listOf("gynec", "obstetr", "obgyn"),
        "pregnancy" to listOf("obstetr", "gynec", "matern"),
        "pregnant" to listOf("obstetr", "gynec"),
        "period" to listOf("gynec", "menstru"),
        "menstrual" to listOf("gynec"),
        "gynecologist" to listOf("gynec", "obstetr", "obgyn"),
        "gynecology" to listOf("gynec", "obstetr", "obgyn"),
        "delivery" to listOf("obstetr", "matern"),

        // Neurology / Brain
        "brain" to listOf("neuro", "brain"),
        "nerve" to listOf("neuro", "nerve"),
        "nerves" to listOf("neuro"),
        "headache" to listOf("neuro", "general", "physician"),
        "migraine" to listOf("neuro"),
        "stroke" to listOf("neuro"),
        "paralysis" to listOf("neuro", "physiotherap"),
        "seizure" to listOf("neuro", "epilep"),
        "neurologist" to listOf("neuro", "brain"),
        "neurology" to listOf("neuro", "brain"),

        // Psychiatry / Mind
        "mind" to listOf("psychiatr", "psycholog", "mental"),
        "mental" to listOf("psychiatr", "psycholog", "mental"),
        "depression" to listOf("psychiatr", "psycholog", "mental"),
        "anxiety" to listOf("psychiatr", "psycholog"),
        "stress" to listOf("psychiatr", "psycholog"),
        "sleep" to listOf("psychiatr", "neuro", "pulmon"),
        "insomnia" to listOf("psychiatr", "neuro"),
        "psychiatrist" to listOf("psychiatr", "mental"),
        "psychiatry" to listOf("psychiatr", "mental"),

        // Gastroenterology / Stomach
        "stomach" to listOf("gastro", "digest", "internal medicine"),
        "digest" to listOf("gastro", "digest"),
        "digestion" to listOf("gastro", "digest"),
        "gastric" to listOf("gastro", "acidity"),
        "acidity" to listOf("gastro", "internal medicine"),
        "liver" to listOf("hepatol", "gastro"),
        "constipation" to listOf("gastro"),
        "diarrhea" to listOf("gastro", "general"),
        "gastroenterologist" to listOf("gastro", "digest"),
        "gastroenterology" to listOf("gastro", "digest"),

        // Nephrology & Urology / Kidney
        "kidney" to listOf("nephro", "uro", "kidney", "renal"),
        "urine" to listOf("uro", "nephro"),
        "urinary" to listOf("uro", "nephro"),
        "stone" to listOf("uro", "nephro", "surgeon"),
        "prostate" to listOf("uro"),
        "dialysis" to listOf("nephro"),
        "nephrologist" to listOf("nephro", "kidney"),
        "urologist" to listOf("uro", "urinary"),

        // Oncology / Cancer
        "cancer" to listOf("oncol", "cancer", "tumor"),
        "tumor" to listOf("oncol", "surgeon"),
        "chemo" to listOf("oncol"),
        "oncologist" to listOf("oncol", "cancer"),
        "oncology" to listOf("oncol", "cancer"),

        // Pulmonology / Lungs & Chest
        "lungs" to listOf("pulmon", "chest", "respirat"),
        "breath" to listOf("pulmon", "respirat"),
        "breathing" to listOf("pulmon", "respirat"),
        "asthma" to listOf("pulmon", "allergy"),
        "tb" to listOf("pulmon", "tubercul", "chest"),
        "tuberculosis" to listOf("pulmon", "tubercul"),
        "pulmonologist" to listOf("pulmon", "chest"),
        "pulmonology" to listOf("pulmon", "chest"),

        // Endocrinology / Diabetes & Thyroid
        "sugar" to listOf("endocrin", "diabet", "internal medicine"),
        "diabetes" to listOf("endocrin", "diabet", "internal medicine"),
        "diabetic" to listOf("endocrin", "diabet"),
        "thyroid" to listOf("endocrin", "internal medicine"),
        "hormone" to listOf("endocrin"),
        "endocrinologist" to listOf("endocrin"),

        // General Medicine
        "fever" to listOf("general", "internal medicine", "physician"),
        "cold" to listOf("general", "physician", "ent"),
        "cough" to listOf("general", "pulmon", "physician"),
        "general" to listOf("general", "internal medicine", "physician"),
        "physician" to listOf("physician", "general", "internal medicine"),
        "checkup" to listOf("general", "internal medicine"),

        // Pathology & Lab Tests
        "blood" to listOf("patholog", "lab", "diagnostic", "hematol", "cbc", "blood"),
        "blood test" to listOf("lab", "patholog", "diagnostic", "cbc", "hematol"),
        "test" to listOf("lab", "patholog", "diagnostic", "test"),
        "lab" to listOf("lab", "patholog", "diagnostic"),
        "pathology" to listOf("patholog", "lab", "diagnostic"),
        "cbc" to listOf("cbc", "blood", "lab", "patholog", "hematol"),
        "complete blood count" to listOf("cbc", "blood", "lab", "patholog"),
        "hemoglobin" to listOf("cbc", "blood", "lab", "patholog"),
        "platelet" to listOf("cbc", "blood", "lab", "patholog"),
        "platelets" to listOf("cbc", "blood", "lab", "patholog"),
        "thyroid" to listOf("thyroid", "tsh", "lab", "endocrin"),
        "tsh" to listOf("thyroid", "tsh", "lab"),
        "lipid" to listOf("lipid", "cholesterol", "lab", "cardio"),
        "cholesterol" to listOf("lipid", "cholesterol", "lab"),
        "urine" to listOf("urine", "urinalysis", "lab", "uro"),
        "urinalysis" to listOf("urine", "urinalysis", "lab"),
        "glucose" to listOf("glucose", "sugar", "fbs", "lab", "diabet"),
        "sugar test" to listOf("glucose", "sugar", "fbs", "lab"),
        "fbs" to listOf("glucose", "sugar", "fbs", "lab"),
        "hba1c" to listOf("glucose", "sugar", "hba1c", "lab"),
        "lft" to listOf("lft", "liver", "lab", "hepatol"),
        "kft" to listOf("kft", "kidney", "renal", "lab", "nephro"),
        "creatinine" to listOf("kft", "kidney", "renal", "lab"),

        // Radiology & Scans
        "xray" to listOf("radiolog", "imaging"),
        "x-ray" to listOf("radiolog", "imaging"),
        "ultrasound" to listOf("radiolog", "sonolog"),
        "usg" to listOf("radiolog", "sonolog"),
        "ct" to listOf("radiolog", "imaging"),
        "mri" to listOf("radiolog", "imaging"),
        "scan" to listOf("radiolog", "imaging"),

        // Surgery
        "surgery" to listOf("surgeon", "surgery", "surgical"),
        "surgeon" to listOf("surgeon", "surgery"),
        "operation" to listOf("surgeon", "surgery"),

        // Physiotherapy
        "physio" to listOf("physiotherap", "rehab"),
        "physiotherapy" to listOf("physiotherap", "rehab")
    )

    // Symptom / Keyword to Human-Readable Specialist Suggestions (e.g., "skin" -> "Dermatologist")
    private val symptomToSpecialistSuggestions: Map<String, List<String>> = mapOf(
        "skin" to listOf("Dermatologist", "Dermatology", "Cosmetologist"),
        "derma" to listOf("Dermatologist", "Dermatology"),
        "acne" to listOf("Dermatologist", "Cosmetologist"),
        "pimple" to listOf("Dermatologist"),
        "rash" to listOf("Dermatologist", "Allergist"),
        "allergy" to listOf("Dermatologist", "Allergist", "Pulmonologist"),
        "hair" to listOf("Dermatologist", "Trichologist"),
        "eczema" to listOf("Dermatologist"),
        "fungal" to listOf("Dermatologist"),
        "itch" to listOf("Dermatologist"),

        "heart" to listOf("Cardiologist", "Cardiology", "Internal Medicine"),
        "cardio" to listOf("Cardiologist", "Cardiology"),
        "chest" to listOf("Cardiologist", "Pulmonologist", "General Physician"),
        "bp" to listOf("Cardiologist", "General Physician"),
        "pressure" to listOf("Cardiologist", "Internal Medicine"),
        "hypertension" to listOf("Cardiologist", "Internal Medicine"),

        "bone" to listOf("Orthopedic", "Orthopedician", "Physiotherapist"),
        "ortho" to listOf("Orthopedic", "Orthopedician"),
        "joint" to listOf("Orthopedic", "Rheumatologist"),
        "fracture" to listOf("Orthopedic", "Trauma Surgeon"),
        "knee" to listOf("Orthopedic", "Physiotherapist"),
        "back" to listOf("Orthopedic", "Spine Specialist", "Physiotherapist"),
        "spine" to listOf("Orthopedic", "Neurologist"),
        "arthritis" to listOf("Orthopedic", "Rheumatologist"),

        "eye" to listOf("Ophthalmologist", "Optometrist", "Eye Specialist"),
        "vision" to listOf("Ophthalmologist", "Optometrist"),
        "cataract" to listOf("Ophthalmologist"),
        "retina" to listOf("Ophthalmologist"),

        "tooth" to listOf("Dentist", "Dental Surgeon"),
        "teeth" to listOf("Dentist", "Dental Surgeon", "Orthodontist"),
        "dent" to listOf("Dentist", "Dental Care"),
        "gum" to listOf("Dentist", "Periodontist"),
        "cavity" to listOf("Dentist"),

        "child" to listOf("Pediatrician", "Pediatrics", "Child Specialist"),
        "baby" to listOf("Pediatrician", "Neonatologist"),
        "kid" to listOf("Pediatrician", "Child Specialist"),
        "infant" to listOf("Pediatrician", "Neonatologist"),
        "pediatr" to listOf("Pediatrician", "Pediatrics"),
        "vaccine" to listOf("Pediatrician", "General Physician"),

        "ear" to listOf("ENT Specialist", "Otolaryngologist"),
        "nose" to listOf("ENT Specialist", "Otolaryngologist"),
        "throat" to listOf("ENT Specialist", "Otolaryngologist"),
        "ent" to listOf("ENT Specialist", "Otolaryngologist"),
        "sinus" to listOf("ENT Specialist"),
        "tonsil" to listOf("ENT Specialist"),

        "women" to listOf("Gynecologist", "Obstetrician", "OB-GYN"),
        "female" to listOf("Gynecologist", "OB-GYN"),
        "pregnan" to listOf("Gynecologist", "Obstetrician"),
        "period" to listOf("Gynecologist"),
        "gynec" to listOf("Gynecologist", "Obstetrician"),

        "brain" to listOf("Neurologist", "Neurosurgeon"),
        "nerve" to listOf("Neurologist"),
        "headache" to listOf("Neurologist", "General Physician"),
        "migraine" to listOf("Neurologist"),
        "neuro" to listOf("Neurologist", "Neurology"),
        "stroke" to listOf("Neurologist"),

        "mind" to listOf("Psychiatrist", "Psychologist"),
        "mental" to listOf("Psychiatrist", "Psychologist"),
        "depress" to listOf("Psychiatrist", "Psychologist"),
        "anxiet" to listOf("Psychiatrist", "Psychologist"),
        "stress" to listOf("Psychiatrist", "Psychologist"),
        "sleep" to listOf("Psychiatrist", "Neurologist"),

        "stomach" to listOf("Gastroenterologist", "General Physician"),
        "gastric" to listOf("Gastroenterologist", "Internal Medicine"),
        "digest" to listOf("Gastroenterologist"),
        "liver" to listOf("Gastroenterologist", "Hepatologist"),
        "acidity" to listOf("Gastroenterologist", "General Physician"),

        "kidney" to listOf("Nephrologist", "Urologist"),
        "urine" to listOf("Urologist", "Nephrologist"),
        "stone" to listOf("Urologist", "General Surgeon"),

        "cancer" to listOf("Oncologist", "Oncology"),
        "tumor" to listOf("Oncologist", "Surgeon"),

        "lung" to listOf("Pulmonologist", "Chest Specialist"),
        "breath" to listOf("Pulmonologist"),
        "asthma" to listOf("Pulmonologist"),
        "cough" to listOf("General Physician", "Pulmonologist"),

        "sugar" to listOf("Endocrinologist", "Diabetologist", "Internal Medicine"),
        "diabet" to listOf("Endocrinologist", "Diabetologist"),
        "thyroid" to listOf("Endocrinologist", "Internal Medicine"),

        "fever" to listOf("General Physician", "Internal Medicine"),
        "cold" to listOf("General Physician", "ENT Specialist"),
        "flu" to listOf("General Physician"),
        "general" to listOf("General Physician", "Internal Medicine"),
        "physician" to listOf("General Physician", "Internal Medicine"),
        "physio" to listOf("Physiotherapist", "Rehabilitation")
    )

    private val suggestedSpecialtiesCache = java.util.concurrent.ConcurrentHashMap<String, List<String>>()
    private val expandedStemsCache = java.util.concurrent.ConcurrentHashMap<String, Set<String>>()

    /**
     * Returns suggested specialist titles for a user's search query.
     * e.g. searching "skin" immediately returns ["Dermatologist", "Dermatology", "Cosmetologist"]
     */
    fun getSuggestedSpecialties(query: String): List<String> {
        val clean = query.trim().lowercase(Locale.ROOT)
        if (clean.length < 2) return emptyList()
        suggestedSpecialtiesCache[clean]?.let { return it }

        val suggestions = linkedSetOf<String>()
        val tokens = clean.split("\\s+".toRegex()).filter { it.length >= 2 }

        // Direct or prefix match against symptomToSpecialistSuggestions keys
        for ((key, specialists) in symptomToSpecialistSuggestions) {
            if (key == clean || key.startsWith(clean) || clean.contains(key) ||
                tokens.any { tok -> key == tok || key.startsWith(tok) || tok.contains(key) }
            ) {
                suggestions.addAll(specialists)
            }
        }

        // Also check if any specialist name itself matches the query prefix
        if (suggestions.isEmpty()) {
            for (specialists in symptomToSpecialistSuggestions.values) {
                for (spec in specialists) {
                    if (spec.lowercase(Locale.ROOT).contains(clean)) {
                        suggestions.add(spec)
                    }
                }
            }
        }

        val result = suggestions.toList()
        suggestedSpecialtiesCache[clean] = result
        return result
    }

    /**
     * Expands a search query into searchable stems/keywords.
     * e.g. "skin" -> ["skin", "dermatol", "cosmetol", "venereol", "derma", "dermatologist"]
     */
    fun expandQuery(query: String): Set<String> {
        val clean = query.trim().lowercase(Locale.ROOT)
        if (clean.isBlank()) return emptySet()
        expandedStemsCache[clean]?.let { return it }

        val tokens = clean.split("\\s+".toRegex()).filter { it.isNotBlank() }
        val stems = mutableSetOf<String>()
        stems.add(clean)
        stems.addAll(tokens)

        // Add whole query synonyms & prefix matches
        for ((key, syns) in synonymMap) {
            if (key == clean || (clean.length >= 3 && key.startsWith(clean)) || clean.contains(key)) {
                stems.addAll(syns)
            }
        }

        // Add token-by-token synonyms
        for (token in tokens) {
            synonymMap[token]?.let { stems.addAll(it) }
            if (token.length >= 3) {
                for ((key, syns) in synonymMap) {
                    if (key.startsWith(token)) {
                        stems.addAll(syns)
                    }
                }
            }
        }

        // Also include suggested specialty stems
        getSuggestedSpecialties(clean).forEach { spec ->
            stems.add(spec.lowercase(Locale.ROOT))
        }

        expandedStemsCache[clean] = stems
        return stems
    }

    /**
     * Matches an individual Doctor (and their associated clinics) against a user search query.
     */
    fun matchDoctor(
        doctor: Doctor,
        clinics: List<Clinic>,
        query: String
    ): SearchMatchResult {
        val q = query.trim().lowercase(Locale.ROOT)
        if (q.isBlank()) return SearchMatchResult(isMatch = true, score = 50, matchedDoctors = listOf(doctor))

        val corpus = OpenRouteSpatialEngine.getDoctorCorpus(doctor, clinics)
        val expandedStems = expandQuery(q)

        // Fast O(1) rejection against pre-indexed combined corpus before detailed scoring
        val anyStemInCorpus = corpus.combinedCorpus.contains(q) || expandedStems.any { corpus.combinedCorpus.contains(it) }
        if (!anyStemInCorpus) {
            return SearchMatchResult(isMatch = false, score = 0)
        }

        val suggestedSpecs = getSuggestedSpecialties(q)
        var score = 0
        var highlightReason: String? = null

        val docNameLower = corpus.nameLower
        val allDocSpecText = corpus.allSpecsLower
        val docBioLower = corpus.bioLower
        val docEduLower = corpus.eduLower

        // 1. Direct Doctor Name Match
        if (docNameLower.contains(q) || "dr. $docNameLower".contains(q)) {
            score += 110
            highlightReason = "Matched Doctor: Dr. ${doctor.fullName}"
        }

        // 2. Direct Specialty Match
        if (allDocSpecText.contains(q)) {
            score += 100
            if (highlightReason == null) {
                highlightReason = "Specialist: ${doctor.specialty ?: doctor.specialties.firstOrNull() ?: "Specialist"}"
            }
        }

        // 3. Semantic / Symptom Stem Match (e.g., "skin" -> "dermatol" -> matches "Dermatologist")
        for (stem in expandedStems) {
            if (allDocSpecText.contains(stem)) {
                score += 90
                if (highlightReason == null) {
                    val matchedSug = suggestedSpecs.firstOrNull() ?: doctor.specialty ?: "Specialist"
                    highlightReason = "Suggested for '$query': $matchedSug"
                }
                break
            }
            if (docBioLower.contains(stem) || docEduLower.contains(stem)) {
                score += 65
                if (highlightReason == null) {
                    highlightReason = "Recommended ${doctor.specialty ?: "Specialist"} for '$query'"
                }
                break
            }
            if (docNameLower.contains(stem)) {
                score += 75
                if (highlightReason == null) {
                    highlightReason = "Matched Doctor: Dr. ${doctor.fullName}"
                }
                break
            }
        }

        // 4. Associated Clinic Name / Location / Specialty Match
        if (corpus.clinicsJoinedLower.contains(q) || expandedStems.any { corpus.clinicsJoinedLower.contains(it) }) {
            for (clinic in clinics) {
                val cName = clinic.name.lowercase(Locale.ROOT)
                val cAddr = (clinic.addressText ?: "").lowercase(Locale.ROOT)
                val cSpecs = clinic.specialties.joinToString(" ").lowercase(Locale.ROOT)
                if (cName.contains(q) || cAddr.contains(q)) {
                    score += 55
                    if (highlightReason == null) {
                        highlightReason = "Practices at ${clinic.name}"
                    }
                    break
                }
                for (stem in expandedStems) {
                    if (cSpecs.contains(stem)) {
                        score += 45
                        if (highlightReason == null) {
                            highlightReason = "${doctor.specialty ?: "Doctor"} at ${clinic.name}"
                        }
                        break
                    }
                }
            }
        }

        return SearchMatchResult(
            isMatch = score > 0,
            score = score,
            matchedDoctors = if (score > 0) listOf(doctor) else emptyList(),
            matchHighlightReason = highlightReason
        )
    }

    /**
     * Matches a clinic, its doctors, and its services against a user search query.
     */
    fun matchClinic(
        clinic: Clinic,
        doctors: List<Doctor>,
        services: List<ClinicService>,
        query: String
    ): SearchMatchResult {
        val q = query.trim().lowercase(Locale.ROOT)
        if (q.isBlank()) return SearchMatchResult(isMatch = true, score = 0)

        val corpus = OpenRouteSpatialEngine.getClinicCorpus(clinic, doctors, services)
        val expandedStems = expandQuery(q)

        // Fast O(1) rejection against pre-indexed combined corpus before detailed scoring
        val anyStemInCorpus = corpus.combinedCorpus.contains(q) || expandedStems.any { corpus.combinedCorpus.contains(it) }
        if (!anyStemInCorpus) {
            return SearchMatchResult(isMatch = false, score = 0)
        }
        val suggestedSpecs = getSuggestedSpecialties(q)
        var score = 0
        var highlightReason: String? = null
        val matchedDocs = mutableListOf<Doctor>()

        val clinicNameLower = clinic.name.lowercase(Locale.ROOT)
        val clinicAddrLower = (clinic.addressText ?: "").lowercase(Locale.ROOT)
        val clinicTypeLower = (clinic.type ?: "").lowercase(Locale.ROOT)
        val clinicDescLower = (clinic.description ?: "").lowercase(Locale.ROOT)
        val clinicSpecsLower = clinic.specialties.map { it.lowercase(Locale.ROOT) }

        // 1. Direct Clinic Name or Address match (Highest priority)
        if (clinicNameLower.contains(q)) {
            score += 100
            highlightReason = "Matched Clinic Name: ${clinic.name}"
        }
        if (clinicAddrLower.contains(q)) {
            score += 80
            if (highlightReason == null) highlightReason = "Matched Location: ${clinic.addressText}"
        }

        // 2. Clinic Specialties Match (Direct & Semantic Stems like "skin" -> "Dermatology")
        for (cSpec in clinic.specialties) {
            val cSpecLower = cSpec.lowercase(Locale.ROOT)
            if (cSpecLower.contains(q)) {
                score += 85
                if (highlightReason == null) highlightReason = "Specialty: $cSpec"
            } else {
                for (stem in expandedStems) {
                    if (cSpecLower.contains(stem)) {
                        score += 75
                        if (highlightReason == null) {
                            val sug = suggestedSpecs.firstOrNull() ?: cSpec
                            highlightReason = "Suggested ($sug): $cSpec"
                        }
                        break
                    }
                }
            }
        }

        // 3. Doctor matching (Name, Specialty, Specialties list, Qualifications)
        for (doc in doctors) {
            val docNameLower = doc.fullName.lowercase(Locale.ROOT)
            val docSpecLower = (doc.specialty ?: "").lowercase(Locale.ROOT)
            val docSpecsListLower = doc.specialties.map { it.lowercase(Locale.ROOT) }
            val allDocSpecs = (listOf(docSpecLower) + docSpecsListLower).joinToString(" ")
            val docBioLower = (doc.bio ?: "").lowercase(Locale.ROOT)

            var docMatched = false

            // Direct name match
            if (docNameLower.contains(q)) {
                score += 90
                docMatched = true
                if (highlightReason == null) highlightReason = "Matched Doctor: Dr. ${doc.fullName}"
            }

            // Specialty exact match
            if (allDocSpecs.contains(q)) {
                score += 85
                docMatched = true
                if (highlightReason == null) highlightReason = "Specialist: ${doc.specialty ?: doc.specialties.firstOrNull()} (Dr. ${doc.fullName})"
            }

            // Semantic stems match (e.g. searching "skin" matching "Dermatologist")
            for (stem in expandedStems) {
                if (allDocSpecs.contains(stem) || docNameLower.contains(stem) || docBioLower.contains(stem)) {
                    score += 75
                    docMatched = true
                    if (highlightReason == null) {
                        val displaySpec = doc.specialty?.takeIf { it.isNotBlank() }
                            ?: suggestedSpecs.firstOrNull()
                            ?: "Specialist"
                        highlightReason = "Has $displaySpec: Dr. ${doc.fullName}"
                    }
                    break
                }
            }

            if (docMatched) {
                matchedDocs.add(doc)
            }
        }

        // 4. Service / Diagnostic Lab Test matching
        val isLabClinic = (clinic.type ?: "").contains("lab", ignoreCase = true) || (clinic.type ?: "").equals("diagnostic_lab", ignoreCase = true)
        val testServices = if (isLabClinic && services.isEmpty()) {
            listOf(
                ClinicService(id = "def_cbc", clinicId = clinic.id, serviceName = "Complete Blood Count (CBC)", description = "Includes Hb, TLC, DLC, Platelets", price = 350.0),
                ClinicService(id = "def_lipid", clinicId = clinic.id, serviceName = "Lipid Profile", description = "Cholesterol, Triglycerides, HDL, LDL", price = 650.0),
                ClinicService(id = "def_thyroid", clinicId = clinic.id, serviceName = "Thyroid Profile (T3, T4, TSH)", description = "Full thyroid screening", price = 800.0),
                ClinicService(id = "def_urine", clinicId = clinic.id, serviceName = "Urine Routine & Microscopic", description = "Complete urine examination", price = 200.0),
                ClinicService(id = "def_glucose", clinicId = clinic.id, serviceName = "Fasting Blood Sugar (FBS)", description = "Blood glucose test", price = 150.0)
            )
        } else services

        for (srv in testServices) {
            val srvLower = srv.serviceName.lowercase(Locale.ROOT)
            val srvDescLower = (srv.description ?: "").lowercase(Locale.ROOT)
            if (srvLower.contains(q) || (q.length >= 3 && srvDescLower.contains(q))) {
                score += if (isLabClinic) 115 else 60
                if (highlightReason == null) {
                    highlightReason = if (isLabClinic) "Offers Lab Test: ${srv.serviceName} (Rs. ${srv.price.toInt()})" else "Service Offered: ${srv.serviceName}"
                }
            } else {
                for (stem in expandedStems) {
                    if (srvLower.contains(stem) || (stem.length >= 3 && srvDescLower.contains(stem))) {
                        score += if (isLabClinic) 95 else 50
                        if (highlightReason == null) {
                            highlightReason = if (isLabClinic) "Offers Lab Test: ${srv.serviceName} (Rs. ${srv.price.toInt()})" else "Service Offered: ${srv.serviceName}"
                        }
                        break
                    }
                }
            }
        }

        // 5. Fallback: stem matching against clinic name, address, description, or type
        for (stem in expandedStems) {
            if (clinicNameLower.contains(stem)) {
                score += 40
                if (highlightReason == null) highlightReason = "Clinic Name Match: ${clinic.name}"
            }
            if (clinicDescLower.contains(stem)) {
                score += 35
                if (highlightReason == null) highlightReason = "Clinic Specialty Match: ${clinic.name}"
            }
            if (clinicAddrLower.contains(stem)) {
                score += 30
                if (highlightReason == null) highlightReason = "Location Match: ${clinic.addressText}"
            }
            if (clinicTypeLower.contains(stem)) {
                score += 20
            }
        }

        val isMatch = score > 0
        return SearchMatchResult(
            isMatch = isMatch,
            score = score,
            matchedDoctors = matchedDocs.distinctBy { it.id },
            matchHighlightReason = highlightReason
        )
    }

    /**
     * Recommended search suggestion chips to help the patient find common specialties.
     */
    val quickSpecialtySuggestions = listOf(
        "Skin / Dermatologist",
        "Heart / Cardiologist",
        "Bone & Joint (Ortho)",
        "Dental Care",
        "Child / Pediatrician",
        "Eye Specialist",
        "Women / Gynecologist",
        "ENT Specialist",
        "General Physician"
    )
}

