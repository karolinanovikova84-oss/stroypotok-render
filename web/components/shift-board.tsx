"use client";

import { useState } from "react";

import type { Project, Shift } from "../lib/api";
import { ShiftForm } from "./shift-form";

type Props = {
  initialShifts: Shift[];
  projects: Project[];
  token: string;
};

export function ShiftBoard({ initialShifts, projects, token }: Props) {
  const [shifts, setShifts] = useState(initialShifts);

  return (
    <div className="split">
      <ShiftForm
        token={token}
        projects={projects}
        onCreated={(shift) => setShifts((current) => [shift, ...current])}
      />

      <div className="tableCard">
        <div className="sectionHead" style={{ marginTop: 0 }}>
          <div>
            <h3>Активные смены</h3>
          </div>
          <span className="status">{shifts.length} всего</span>
        </div>

        <div className="list">
          {shifts.length === 0 ? (
            <div className="item">
              <h4>Пока нет смен</h4>
              <div className="meta">Смен пока нет.</div>
            </div>
          ) : (
            shifts.map((shift) => (
              <div className="item" key={shift.id}>
                <div className="item__head">
                  <h4>{shift.title}</h4>
                  <span className="status">{shift.status}</span>
                </div>
                <div className="meta">
                  <div>Объект: {shift.project?.title || shift.projectId}</div>
                  <div>
                    Время: {new Date(shift.startsAt).toLocaleString("ru-RU")} -{" "}
                    {new Date(shift.endsAt).toLocaleString("ru-RU")}
                  </div>
                  <div>Нужно рабочих: {shift.workersNeeded}</div>
                  <div>Ставка: {Number(shift.hourlyRate)} ₽/час</div>
                  <div>Записей: {shift._count?.assignments ?? 0}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
