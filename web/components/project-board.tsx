"use client";

import { useState } from "react";

import type { Project } from "../lib/api";
import { ProjectForm } from "./project-form";

type Props = {
  initialProjects: Project[];
  token: string;
};

export function ProjectBoard({ initialProjects, token }: Props) {
  const [projects, setProjects] = useState(initialProjects);

  return (
    <div className="split">
      <ProjectForm token={token} onCreated={(project) => setProjects((current) => [project, ...current])} />

      <div className="tableCard">
        <div className="sectionHead" style={{ marginTop: 0 }}>
          <div>
            <h3>Объекты в работе</h3>
            <p>Здесь менеджер видит базу объектов и количество связанных смен.</p>
          </div>
          <span className="status">{projects.length} всего</span>
        </div>

        <div className="list">
          {projects.length === 0 ? (
            <div className="item">
              <h4>Пока пусто</h4>
              <div className="meta">Создайте первый объект слева, и он сразу появится здесь.</div>
            </div>
          ) : (
            projects.map((project) => (
              <div className="item" key={project.id}>
                <div className="item__head">
                  <h4>{project.title}</h4>
                  <span className="status">{project.status}</span>
                </div>
                <div className="meta">
                  <div>Адрес: {project.address}</div>
                  <div>Клиент: {project.clientName || "не указан"}</div>
                  <div>Телефон: {project.clientPhone || "не указан"}</div>
                  <div>Смен: {project._count?.shifts ?? 0}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
