"use client";

import { useState } from "react";

import { createShift, type Project, type Shift } from "../lib/api";

type Props = {
  token: string;
  projects: Project[];
  onCreated: (shift: Shift) => void;
};

export function ShiftForm({ token, projects, onCreated }: Props) {
  const [form, setForm] = useState({
    projectId: projects[0]?.id || "",
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    workersNeeded: 5,
    hourlyRate: 450,
    status: "OPEN" as Shift["status"]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const shift = await createShift(
        {
          ...form,
          description: form.description || undefined
        },
        token
      );

      setMessage("Смена опубликована.");
      setForm((current) => ({
        ...current,
        title: "",
        description: "",
        startsAt: "",
        endsAt: "",
        workersNeeded: 5,
        hourlyRate: 450,
        status: "OPEN"
      }));
      onCreated(shift);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось создать смену.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="formCard">
      <h3>Новая смена</h3>
      <p className="meta">Смены уже привязаны к объекту и готовы для будущей записи рабочих.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="shift-project">Объект</label>
          <select
            id="shift-project"
            value={form.projectId}
            onChange={(event) =>
              setForm((current) => ({ ...current, projectId: event.target.value }))
            }
            required
          >
            {projects.length === 0 ? <option value="">Сначала создайте объект</option> : null}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="shift-title">Название смены</label>
          <input
            id="shift-title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Дневная смена бетонщиков"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="shift-description">Описание</label>
          <textarea
            id="shift-description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Что делаем на смене, какой участок, какой состав бригады"
          />
        </div>

        <div className="field">
          <label htmlFor="shift-start">Начало</label>
          <input
            id="shift-start"
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) =>
              setForm((current) => ({ ...current, startsAt: event.target.value }))
            }
            required
          />
        </div>

        <div className="field">
          <label htmlFor="shift-end">Конец</label>
          <input
            id="shift-end"
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) =>
              setForm((current) => ({ ...current, endsAt: event.target.value }))
            }
            required
          />
        </div>

        <div className="field">
          <label htmlFor="shift-workers">Сколько нужно людей</label>
          <input
            id="shift-workers"
            type="number"
            min={1}
            value={form.workersNeeded}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                workersNeeded: Number(event.target.value || 0)
              }))
            }
            required
          />
        </div>

        <div className="field">
          <label htmlFor="shift-rate">Ставка в час</label>
          <input
            id="shift-rate"
            type="number"
            min={1}
            value={form.hourlyRate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                hourlyRate: Number(event.target.value || 0)
              }))
            }
            required
          />
        </div>

        <div className="field">
          <label htmlFor="shift-status">Статус</label>
          <select
            id="shift-status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as Shift["status"]
              }))
            }
          >
            <option value="PLANNED">Запланирована</option>
            <option value="OPEN">Открыта</option>
            <option value="FULL">Набрана</option>
            <option value="IN_PROGRESS">Идет</option>
            <option value="COMPLETED">Завершена</option>
            <option value="CANCELLED">Отменена</option>
          </select>
        </div>

        {message ? <div className="message message--ok">{message}</div> : null}
        {error ? <div className="message message--error">{error}</div> : null}

        <button className="button" type="submit" disabled={isSubmitting || projects.length === 0}>
          {isSubmitting ? "Создаем..." : "Создать смену"}
        </button>
      </form>
    </div>
  );
}
