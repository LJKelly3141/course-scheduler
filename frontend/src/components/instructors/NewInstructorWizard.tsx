import { useState } from "react";
import { toast } from "sonner";
import { useCreateInstructor, useSaveAvailabilityTemplate, useUpdateInstructor } from "@/hooks/useInstructorHub";
import { AvailabilityGrid, type AvailabilitySlot } from "./AvailabilityGrid";
import { TermTypeToggle } from "./TermTypeToggle";
import type { Instructor } from "@/api/types";

interface NewInstructorWizardProps {
  onClose: () => void;
  onCreated: (id: number) => void;
}

const MODALITY_CARDS = [
  { value: "any", label: "Any", desc: "No restrictions" },
  { value: "online_only", label: "Online Only", desc: "Remote teaching only" },
  { value: "mwf_only", label: "MWF Only", desc: "Mon/Wed/Fri blocks" },
  { value: "tth_only", label: "TTh Only", desc: "Tue/Thu blocks" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Select type" },
  { value: "faculty", label: "Faculty" },
  { value: "ias", label: "IAS" },
  { value: "adjunct", label: "Adjunct" },
  { value: "nias", label: "NIAS" },
];

const RANK_OPTIONS = [
  { value: "", label: "Select rank" },
  { value: "professor", label: "Professor" },
  { value: "associate_professor", label: "Associate Professor" },
  { value: "assistant_professor", label: "Assistant Professor" },
  { value: "senior_lecturer", label: "Senior Lecturer" },
  { value: "lecturer", label: "Lecturer" },
  { value: "adjunct_instructor", label: "Adjunct Instructor" },
];

const TENURE_OPTIONS = [
  { value: "", label: "Select status" },
  { value: "tenured", label: "Tenured" },
  { value: "tenure_track", label: "Tenure Track" },
  { value: "non_tenure", label: "Non-Tenure" },
];

export function NewInstructorWizard({ onClose, onCreated }: NewInstructorWizardProps) {
  const [step, setStep] = useState(1);
  const createMutation = useCreateInstructor();
  const updateMutation = useUpdateInstructor();
  const saveTemplateMutation = useSaveAvailabilityTemplate();

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    emergency_contact: "",
    office_location: "",
    department: "",
    instructor_type: "",
    rank: "",
    tenure_status: "",
    hire_date: "",
    max_credits: 12,
  });

  const [modality, setModality] = useState("any");
  const [initialNote, setInitialNote] = useState("");

  const [availTermType, setAvailTermType] = useState("fall");
  const [fallSlots, setFallSlots] = useState<AvailabilitySlot[]>([]);
  const [springSlots, setSpringSlots] = useState<AvailabilitySlot[]>([]);
  const [availSummer, setAvailSummer] = useState(true);
  const [availWinter, setAvailWinter] = useState(true);

  const [createdId, setCreatedId] = useState<number | null>(null);

  const setField = (field: string, value: string | number) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const profileValid =
    profile.first_name.trim() &&
    profile.last_name.trim() &&
    profile.email.trim() &&
    profile.department.trim() &&
    profile.instructor_type;

  const inputClass =
    "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent";
  const requiredInputClass =
    "w-full bg-surface border border-accent/50 rounded-md px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "text-xs text-secondary mb-1 block";

  const saveInstructor = async (): Promise<number> => {
    if (createdId) return createdId;

    const data: Partial<Instructor> = {
      ...profile,
      name: `${profile.last_name}, ${profile.first_name}`,
      modality_constraint: modality,
      is_active: true,
      available_summer: availSummer,
      available_winter: availWinter,
    };
    for (const key of ["phone", "emergency_contact", "office_location", "rank", "tenure_status", "hire_date"] as const) {
      if (!(data as Record<string, unknown>)[key]) {
        (data as Record<string, unknown>)[key] = null;
      }
    }

    const result = await createMutation.mutateAsync(data);
    setCreatedId(result.id);
    return result.id;
  };

  const saveTemplates = async (instructorId: number) => {
    if (fallSlots.length > 0) {
      await saveTemplateMutation.mutateAsync({
        instructorId,
        termType: "fall",
        slots: fallSlots,
      });
    }
    if (springSlots.length > 0) {
      await saveTemplateMutation.mutateAsync({
        instructorId,
        termType: "spring",
        slots: springSlots,
      });
    }
  };

  const handleSkipAndSave = async () => {
    try {
      const id = await saveInstructor();
      if (step === 3) {
        await saveTemplates(id);
      }
      toast.success("Instructor created");
      onCreated(id);
    } catch {
      toast.error("Failed to create instructor");
    }
  };

  const handleFinalSave = async () => {
    try {
      const id = await saveInstructor();
      await saveTemplates(id);
      if (!availSummer || !availWinter) {
        await updateMutation.mutateAsync({
          id,
          available_summer: availSummer,
          available_winter: availWinter,
        });
      }
      toast.success("Instructor created");
      onCreated(id);
    } catch {
      toast.error("Failed to create instructor");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-alt border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-center gap-10 py-6 relative">
          <div className="absolute top-[27px] left-[calc(50%-80px)] w-[160px] h-0.5 bg-border" />
          {[
            { n: 1, label: "Profile" },
            { n: 2, label: "Scheduling" },
            { n: 3, label: "Availability" },
          ].map(({ n, label }) => (
            <div key={n} className="flex flex-col items-center gap-1.5 z-10">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step > n
                    ? "bg-emerald-600 text-white"
                    : step === n
                      ? "bg-accent text-white"
                      : "bg-surface text-secondary"
                }`}
              >
                {step > n ? "✓" : n}
              </div>
              <span
                className={`text-xs ${
                  step >= n ? "text-accent font-medium" : "text-secondary"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>First Name <span className="text-red-400">*</span></label>
                  <input className={requiredInputClass} value={profile.first_name} onChange={(e) => setField("first_name", e.target.value)} placeholder="Enter first name" />
                </div>
                <div>
                  <label className={labelClass}>Last Name <span className="text-red-400">*</span></label>
                  <input className={requiredInputClass} value={profile.last_name} onChange={(e) => setField("last_name", e.target.value)} placeholder="Enter last name" />
                </div>
                <div>
                  <label className={labelClass}>Email <span className="text-red-400">*</span></label>
                  <input type="email" className={requiredInputClass} value={profile.email} onChange={(e) => setField("email", e.target.value)} placeholder="name@uwrf.edu" />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input type="tel" className={inputClass} value={profile.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className={labelClass}>Emergency Contact</label>
                  <input type="tel" className={inputClass} value={profile.emergency_contact} onChange={(e) => setField("emergency_contact", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className={labelClass}>Office Location</label>
                  <input className={inputClass} value={profile.office_location} onChange={(e) => setField("office_location", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className={labelClass}>Department <span className="text-red-400">*</span></label>
                  <input className={requiredInputClass} value={profile.department} onChange={(e) => setField("department", e.target.value)} placeholder="Enter department" />
                </div>
                <div>
                  <label className={labelClass}>Type <span className="text-red-400">*</span></label>
                  <select className={requiredInputClass} value={profile.instructor_type} onChange={(e) => setField("instructor_type", e.target.value)}>
                    {TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Rank</label>
                  <select className={inputClass} value={profile.rank} onChange={(e) => setField("rank", e.target.value)}>
                    {RANK_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Tenure Status</label>
                  <select className={inputClass} value={profile.tenure_status} onChange={(e) => setField("tenure_status", e.target.value)}>
                    {TENURE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Hire Date</label>
                  <input type="date" className={inputClass} value={profile.hire_date} onChange={(e) => setField("hire_date", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Max Credits</label>
                  <input type="number" className={inputClass} value={profile.max_credits} onChange={(e) => setField("max_credits", parseInt(e.target.value) || 12)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={onClose} className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface">Cancel</button>
                <button onClick={() => setStep(2)} disabled={!profileValid} className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50">Next: Scheduling →</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Modality Constraint</h4>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {MODALITY_CARDS.map((m) => (
                  <button key={m.value} onClick={() => setModality(m.value)}
                    className={`text-left rounded-lg p-3 border-2 transition-all ${modality === m.value ? "bg-accent/10 border-accent" : "bg-surface border-border hover:border-border-hover"}`}>
                    <div className="text-sm text-primary font-medium">{m.label}</div>
                    <div className="text-xs text-secondary mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>

              <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Initial Note (optional)</h4>
              <textarea className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-tertiary min-h-[80px] resize-y mb-4" placeholder="Any scheduling preferences, contract details, or notes to record..." value={initialNote} onChange={(e) => setInitialNote(e.target.value)} />

              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 mb-6">
                <p className="text-xs text-blue-300">You can set detailed per-day availability in the next step, or skip and add it later.</p>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface">← Back</button>
                <div className="flex gap-2">
                  <button onClick={handleSkipAndSave} className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface">Skip & Save</button>
                  <button onClick={() => setStep(3)} className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90">Next: Availability →</button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex gap-0 border-b border-border mb-4">
                {(["fall", "spring", "summer", "winter"] as const).map((tt) => (
                  <button key={tt} onClick={() => setAvailTermType(tt)}
                    className={`px-5 py-2 text-sm ${availTermType === tt ? "text-accent border-b-2 border-accent font-medium" : "text-secondary hover:text-primary"}`}>
                    {tt.charAt(0).toUpperCase() + tt.slice(1)}
                  </button>
                ))}
              </div>

              {(availTermType === "fall" || availTermType === "spring") && (
                <>
                  <div className="flex gap-3 items-center mb-3 text-xs">
                    <span className="text-secondary">Quick:</span>
                    <button onClick={() => availTermType === "fall" ? setFallSlots([]) : setSpringSlots([])} className="text-accent hover:underline">Set all available</button>
                    {availTermType === "spring" && (
                      <button onClick={() => setSpringSlots([...fallSlots])} className="text-accent hover:underline">Copy Fall → Spring</button>
                    )}
                  </div>
                  <AvailabilityGrid slots={availTermType === "fall" ? fallSlots : springSlots} onChange={availTermType === "fall" ? setFallSlots : setSpringSlots} />
                </>
              )}

              {(availTermType === "summer" || availTermType === "winter") && (
                <TermTypeToggle termType={availTermType} available={availTermType === "summer" ? availSummer : availWinter} onChange={availTermType === "summer" ? setAvailSummer : setAvailWinter} />
              )}

              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(2)} className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface">← Back</button>
                <div className="flex gap-2">
                  <button onClick={handleSkipAndSave} className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface">Skip & Save</button>
                  <button onClick={handleFinalSave} disabled={createMutation.isPending} className="px-4 py-1.5 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-500 disabled:opacity-50">
                    {createMutation.isPending ? "Saving..." : "✓ Save Instructor"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
