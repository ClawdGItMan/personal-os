"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Barbell,
  BowlFood,
  Check,
  CheckCircle,
  Drop,
  Heartbeat,
  Lightning,
  Minus,
  Moon,
  Plus,
  Sparkle,
  Sun,
} from "@phosphor-icons/react";
import { dayKey, readiness } from "@/lib/stride/training";
import { useStride } from "./Store";
import { Modal, Progress, SectionTitle, Tag } from "./ui";

export function Nutrition() {
  const { state, setState, navigate, toast } = useStride();
  const [mealOpen, setMealOpen] = useState(false);
  const [runMinutes, setRunMinutes] = useState(100);
  const [carbsPerHour, setCarbsPerHour] = useState(45);
  const [gelCarbs, setGelCarbs] = useState(25);
  const today = dayKey();
  const water = state.water[today] || 0;
  const meals = state.meals.filter((m) => m.date === today);
  const carbs = meals.reduce((s, m) => s + m.carbs, 0);
  const protein = meals.reduce((s, m) => s + m.protein, 0);
  const fuelTotal = Math.round((runMinutes / 60) * carbsPerHour);
  const gels = Math.ceil(fuelTotal / gelCarbs);
  function changeWater(amount: number) {
    setState((previous) =>
      previous
        ? {
            ...previous,
            water: {
              ...previous.water,
              [today]: Math.max(
                0,
                Math.min(10000, (previous.water[today] || 0) + amount),
              ),
            },
          }
        : previous,
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">NOURISH THE RUNNER IN YOU</div>
          <h1>Good miles start with good fuel.</h1>
          <p>
            Simple habits for the work you’re doing and the recovery you need.
          </p>
        </div>
        <button className="button primary" onClick={() => setMealOpen(true)}>
          <Plus size={17} />
          Log a meal
        </button>
      </div>
      <div className="nutrition-layout">
        <div>
          <section className="fuel-hero">
            <span className="eyebrow">
              <Lightning size={16} />
              YOUR LONG-RUN FUEL PLAN
            </span>
            <h2>
              Practice today.
              <br />
              Feel prepared on race day.
            </h2>
            <p>
              Build a fueling rhythm with foods and drinks your stomach knows.
            </p>
            <span className="fuel-hero-art">
              <BowlFood size={125} weight="thin" />
            </span>
          </section>
          <section className="panel fuel-planner">
            <SectionTitle
              title="Let’s plan your next long run"
              detail="A starting point to practice and adjust, not a prescription."
            />
            <div className="fuel-inputs">
              <label>
                Run duration
                <span>
                  <input
                    type="number"
                    aria-label="Run duration in minutes"
                    min="30"
                    max="360"
                    value={runMinutes}
                    onChange={(e) =>
                      setRunMinutes(
                        Math.min(360, Math.max(30, Number(e.target.value))),
                      )
                    }
                  />
                  min
                </span>
              </label>
              <label>
                Carbohydrate target
                <span>
                  <input
                    type="number"
                    aria-label="Carbohydrate grams per hour"
                    min="15"
                    max="90"
                    step="5"
                    value={carbsPerHour}
                    onChange={(e) =>
                      setCarbsPerHour(
                        Math.min(90, Math.max(15, Number(e.target.value))),
                      )
                    }
                  />
                  g/hour
                </span>
              </label>
              <label>
                Your gel or serving
                <span>
                  <input
                    type="number"
                    aria-label="Carbohydrates per serving"
                    min="10"
                    max="60"
                    value={gelCarbs}
                    onChange={(e) =>
                      setGelCarbs(
                        Math.min(60, Math.max(10, Number(e.target.value))),
                      )
                    }
                  />
                  g carbs
                </span>
              </label>
            </div>
            <div className="fuel-result">
              <div>
                <strong>
                  {fuelTotal}
                  <small>g</small>
                </strong>
                <span>carbohydrate target</span>
              </div>
              <span className="fuel-result-divider" />
              <div>
                <strong>~{gels}</strong>
                <span>{gelCarbs} g servings</span>
              </div>
              <p>
                Spread fuel across your run. Check labels and include any carbs
                from sports drinks.
              </p>
            </div>
            <div className="fuel-timeline">
              <span>START</span>
              {Array.from({ length: Math.min(gels, 8) }, (_, i) => (
                <div key={i}>
                  <span className="fuel-dot">
                    <Lightning size={14} />
                  </span>
                  <b>{Math.round(((i + 1) * runMinutes) / (gels + 1))} min</b>
                </div>
              ))}
              <span>FINISH</span>
            </div>
            <p className="source-note">
              For roughly 1–2.5 hours of exercise, 30–60 g/hour is a common
              starting range. Longer efforts and higher intakes need individual
              practice.{" "}
              <a
                href="https://www.sportsdietitians.com.au/wp-content/uploads/2015/04/Eating-Drinking-During-Exercise.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Sports Dietitians Australia <ArrowUpRight size={12} />
              </a>
            </p>
          </section>
          <section className="panel meal-panel">
            <SectionTitle
              title="On your plate today"
              action="Add a meal"
              onClick={() => setMealOpen(true)}
            />
            {meals.length ? (
              meals.map((meal) => (
                <div className="meal-row" key={meal.id}>
                  <span className="meal-icon">
                    <BowlFood size={23} />
                  </span>
                  <div>
                    <h3>{meal.name}</h3>
                    <p>
                      {meal.carbs} g carbs · {meal.protein} g protein
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${meal.name}`}
                    onClick={() =>
                      setState((previous) =>
                        previous
                          ? {
                              ...previous,
                              meals: previous.meals.filter(
                                (m) => m.id !== meal.id,
                              ),
                            }
                          : previous,
                      )
                    }
                  >
                    <Minus size={16} />
                  </button>
                </div>
              ))
            ) : (
              <p className="empty-copy">
                No meals logged yet. Start with whatever you enjoyed today.
              </p>
            )}
            <div className="meal-totals">
              <span>Logged today</span>
              <b>{carbs} g carbs</b>
              <b>{protein} g protein</b>
            </div>
          </section>
        </div>
        <aside>
          <section className="panel hydration-panel">
            <div className="section-title">
              <h2>A little hydration check</h2>
              <Drop size={21} />
            </div>
            <div className="water-visual">
              <div className="water-vessel">
                <div
                  style={{ height: `${Math.min(95, (water / 2500) * 100)}%` }}
                />
                <Drop size={35} weight="light" />
              </div>
              <strong>
                {(water / 1000).toFixed(2)}
                <small>liters logged</small>
              </strong>
            </div>
            <Progress value={water} max={2500} tone="blue" />
            <p>
              2.5 L visual reference. Your needs vary; drink to thirst and adapt
              to conditions.
            </p>
            <div className="water-actions">
              <button
                className="button secondary"
                aria-label="Remove 250 milliliters"
                onClick={() => changeWater(-250)}
              >
                <Minus size={16} />
              </button>
              <button
                className="button primary"
                onClick={() => changeWater(250)}
              >
                <Plus size={16} />
                250 ml
              </button>
              <button
                className="button secondary"
                onClick={() => changeWater(500)}
              >
                500 ml
              </button>
            </div>
          </section>
          <section className="panel nutrition-rhythm">
            <SectionTitle title="A simple daily rhythm" />
            {[
              {
                icon: Sun,
                title: "Before your run",
                text: "Familiar carbs. Enough time to digest.",
              },
              {
                icon: Lightning,
                title: "During longer efforts",
                text: "Practice small, regular servings of fuel.",
              },
              {
                icon: BowlFood,
                title: "After the work",
                text: "A balanced meal with carbs and protein.",
              },
              {
                icon: Moon,
                title: "As the day winds down",
                text: "Eat enough. Make space for good sleep.",
              },
            ].map((item) => (
              <div className="rhythm-item" key={item.title}>
                <item.icon size={20} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </section>
          <button
            className="coach-topic-card full text-left"
            onClick={() => navigate("AI coach")}
          >
            <Sparkle size={23} />
            <h3>Fueling feeling complicated?</h3>
            <p>
              Talk through your preferences and what works for your stomach.
            </p>
            <span className="text-button">
              Ask your coach
              <ArrowRight size={16} />
            </span>
          </button>
        </aside>
      </div>
      {mealOpen && (
        <Modal
          title="Fuel worth remembering."
          subtitle="A simple food log. Estimates are perfectly fine."
          close={() => setMealOpen(false)}
        >
          <form
            className="stride-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setState((previous) =>
                previous
                  ? {
                      ...previous,
                      meals: [
                        ...previous.meals,
                        {
                          id: crypto.randomUUID(),
                          date: today,
                          name: String(data.get("name")),
                          carbs: Number(data.get("carbs")),
                          protein: Number(data.get("protein")),
                        },
                      ],
                    }
                  : previous,
              );
              toast("Meal logged.");
              setMealOpen(false);
            }}
          >
            <label>
              What did you have?
              <input
                name="name"
                placeholder="Rice bowl with chicken & vegetables"
                required
                maxLength={100}
              />
            </label>
            <div className="form-grid">
              <label>
                Carbohydrates · g
                <input name="carbs" type="number" min="0" max="500" required />
              </label>
              <label>
                Protein · g
                <input
                  name="protein"
                  type="number"
                  min="0"
                  max="300"
                  required
                />
              </label>
            </div>
            <button className="button primary full" type="submit">
              Save meal
              <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

const exercises = [
  {
    name: "Bodyweight squat",
    target: "2 × 10 reps",
    cue: "Sit your hips back and down through a comfortable range. Keep your knees tracking with your toes; stand tall without rushing.",
    area: "Quads & glutes",
  },
  {
    name: "Glute bridge",
    target: "2 × 12 reps",
    cue: "Lie on your back with knees bent. Press through your feet, lift your hips, pause, and lower with control.",
    area: "Posterior chain",
  },
  {
    name: "Standing calf raise",
    target: "2 × 12 reps",
    cue: "Hold a stable support. Rise onto your toes, pause, then lower slowly. Keep the movement comfortable and controlled.",
    area: "Calves & ankles",
  },
  {
    name: "Side plank",
    target: "2 × 20 sec / side",
    cue: "Rest on your forearm, stack your shoulders, and gently lift your hips. Bend your knees for an easier option. Keep breathing.",
    area: "Core stability",
  },
  {
    name: "Bird dog",
    target: "2 × 8 reps / side",
    cue: "From hands and knees, reach one arm and the opposite leg without arching your back. Pause and change sides.",
    area: "Balance & control",
  },
];
export function Recovery({ checkin }: { checkin: () => void }) {
  const { state, setState, toast, navigate } = useStride();
  const [checked, setChecked] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number | null>(0);
  const today = dayKey();
  const entry = state.checkins.find((c) => c.date === today);
  const ready = readiness(entry);
  const complete = state.strength.includes(today);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">BUILT FOR THE LONG RUN</div>
          <h1>Strong body. Steady progress.</h1>
          <p>Give your body what it needs to keep showing up.</p>
        </div>
        <button className="button primary" onClick={checkin}>
          <Heartbeat size={18} />
          Daily check-in
        </button>
      </div>
      <div className="recovery-overview">
        <div className="readiness-feature">
          <div
            className="readiness-ring"
            style={
              {
                "--score": `${(ready.score || 0) * 3.6}deg`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>{ready.score ?? "—"}</strong>
              <span>READINESS</span>
            </div>
          </div>
          <div>
            <Tag>
              {entry ? "Today’s check-in" : "Waiting for your check-in"}
            </Tag>
            <h2>{ready.label}</h2>
            <p>{ready.detail}</p>
            <button className="text-button" onClick={checkin}>
              {entry ? "Update check-in" : "How are you feeling?"}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        <div className="recovery-signals">
          <div>
            <Moon size={21} />
            <span>Sleep</span>
            <strong>{entry ? `${entry.sleep} h` : "—"}</strong>
          </div>
          <div>
            <Lightning size={21} />
            <span>Energy</span>
            <strong>{entry ? `${entry.energy}/5` : "—"}</strong>
          </div>
          <div>
            <Heartbeat size={21} />
            <span>Soreness</span>
            <strong>{entry ? `${entry.soreness}/10` : "—"}</strong>
          </div>
        </div>
      </div>
      <div className="plan-layout">
        <section className="panel strength-workout">
          <div className="section-title">
            <div>
              <span className="small-kicker">YOUR RUNNER’S FOUNDATION</span>
              <h2>A little strength goes a long way.</h2>
              <p>~25 minutes · Bodyweight · Comfortable, controlled movement</p>
            </div>
            <span className="session-icon violet">
              <Barbell size={26} />
            </span>
          </div>
          <div className="strength-progress">
            <Progress value={complete ? 5 : checked.length} max={5} />
            <span>
              {complete
                ? "Complete for today"
                : `${checked.length} of 5 exercises`}
            </span>
          </div>
          {exercises.map((exercise, index) => (
            <div
              className={`exercise-row ${checked.includes(index) || complete ? "done" : ""}`}
              key={exercise.name}
            >
              <button
                className="exercise-check"
                aria-label={`Mark ${exercise.name} complete`}
                aria-pressed={checked.includes(index) || complete}
                disabled={complete}
                onClick={() =>
                  setChecked((list) =>
                    list.includes(index)
                      ? list.filter((i) => i !== index)
                      : [...list, index],
                  )
                }
              >
                {checked.includes(index) || complete ? (
                  <Check size={18} weight="bold" />
                ) : (
                  <span>{String(index + 1).padStart(2, "0")}</span>
                )}
              </button>
              <div>
                <button
                  className="exercise-name"
                  aria-expanded={expanded === index}
                  onClick={() => setExpanded(expanded === index ? null : index)}
                >
                  <span>
                    <h3>{exercise.name}</h3>
                    <small>{exercise.area}</small>
                  </span>
                  <b>{exercise.target}</b>
                  <Plus size={16} />
                </button>
                {expanded === index && (
                  <p className="exercise-cue">{exercise.cue}</p>
                )}
              </div>
            </div>
          ))}
          <div className="strength-footer">
            <p>Start gently. Stop an exercise if it causes pain.</p>
            <button
              className={`button ${complete ? "secondary" : "primary"}`}
              disabled={!complete && checked.length < 5}
              onClick={() => {
                setState((previous) =>
                  previous
                    ? {
                        ...previous,
                        strength: complete
                          ? previous.strength.filter((d) => d !== today)
                          : [...previous.strength, today],
                      }
                    : previous,
                );
                setChecked([]);
                toast(
                  complete
                    ? "Session marked incomplete."
                    : "Strength session complete. Stronger foundations, one day at a time.",
                );
              }}
            >
              {complete ? (
                <>
                  <CheckCircle size={17} />
                  Completed · Undo
                </>
              ) : (
                <>
                  Complete session
                  <Check size={17} />
                </>
              )}
            </button>
          </div>
        </section>
        <aside>
          <section className="coach-topic-card">
            <Heartbeat size={25} />
            <h3>Listen before you push.</h3>
            <p>
              Sharp pain, pain that worsens, or a change in your stride is a
              reason to stop and assess, not a test of willpower.
            </p>
            <button
              className="text-button"
              onClick={() => navigate("AI coach")}
            >
              Talk about recovery
              <ArrowRight size={15} />
            </button>
          </section>
          <section className="panel recovery-habits">
            <SectionTitle title="The quiet work that counts" />
            {[
              "Keep easy runs conversational",
              "Leave space between hard sessions",
              "Eat enough to support training",
              "Make sleep a daily priority",
              "Adjust when your body asks",
            ].map((text) => (
              <div key={text}>
                <CheckCircle size={18} />
                <span>{text}</span>
              </div>
            ))}
          </section>
          <p className="source-note">
            General education, not an injury assessment.{" "}
            <a
              href="https://www.hss.edu/patient-care/athletes/running"
              target="_blank"
              rel="noreferrer"
            >
              HSS running health resources <ArrowUpRight size={12} />
            </a>
          </p>
        </aside>
      </div>
    </>
  );
}
