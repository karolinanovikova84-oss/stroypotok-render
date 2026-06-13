"use client";

import { useState } from "react";

import { createProject, type Project } from "../lib/api";

type Props = {
  token: string;
  onCreated: (project: Project) => void;
};

export function ProjectForm({ token, onCreated }: Props) {
  const [form, setForm] = useState({
    title: "",
    address: "",
    description: "",
    clientName: "",
    clientPhone: "",
    status: "ACTIVE" as Project["status"],
    startDate: "",
    endDate: ""
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
      const project = await createProject(
        {
          ...form,
          description: form.description || undefined,
          clientName: form.clientName || undefined,
          clientPhone: form.clientPhone || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined
        },
        token
      );

      setMessage("Объект создан и уже записан в базу.");
      setForm({
        title: "",
        address: "",
        description: "",
        clientName: "",
        clientPhone: "",
        status: "ACTIVE",
        startDate: "",
        endDate: ""
      });
      onCreated(project);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Не удалось создать объект."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="formCard">
      <h3>Новый объект</h3>
      <p className="meta">С этого начинается рабочий цикл: заявка, объект, затем смены.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="project-title">Название объекта</label>
          <input
            id="project-title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="ЖК Сосновый"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="project-address">Адрес</label>
          <input
            id="project-address"
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            placeholder="Москва, ул. Примерная, 10"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="project-description">Описание работ</label>
          <textarea
            id="project-description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Монолит, фасад, инженерные работы..."
          />
        </div>

        <div className="field">
          <label htmlFor="project-client">Клиент</label>
          <input
            id="project-client"
            value={form.clientName}
            onChange={(event) =>
              setForm((current) => ({ ...current, clientName: event.target.value }))
            }
            placeholder='ООО "Альфа"'
          />
        </div>

        <div className="field">
          <label htmlFor="project-phone">Телефон клиента</label>
          <input
            id="project-phone"
            value={form.clientPhone}
            onChange={(event) =>
              setForm((current) => ({ ...current, clientPhone: event.target.value }))
            }
            placeholder="+7 999 999-99-99"
          />
        </div>

        <div className="field">
          <label htmlFor="project-status">Статус</label>
          <select
            id="project-status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as Project["status"]
              }))
            }
          >
            <option value="DRAFT">Черновик</option>
            <option value="ACTIVE">Активный</option>
            <option value="PAUSED">Пауза</option>
            <option value="COMPLETED">Завершен</option>
            <option value="CANCELLED">Отменен</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="project-start">Дата старта</label>
          <input
            id="project-start"
            type="date"
            value={form.startDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, startDate: event.target.value }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="project-end">Дата завершения</label>
          <input
            id="project-end"
            type="date"
            value={form.endDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, endDate: event.target.value }))
            }
          />
        </div>

        {message ? <div className="message message--ok">{message}</div> : null}
        {error ? <div className="message message--error">{error}</div> : null}

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Создаем..." : "Создать объект"}
        </button>
      </form>
    </div>
  );
}
