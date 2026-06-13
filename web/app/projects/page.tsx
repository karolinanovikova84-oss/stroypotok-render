import Link from "next/link";

export default function ProjectsPage() {
  return (
    <div className="authShell">
      <h1>Объекты доступны в кабинете</h1>
      <p className="meta">Список объектов зависит от роли пользователя: администратор видит все, прораб только свои, клиент только свои.</p>
      <Link className="button" href="/cabinet">
        Открыть кабинет
      </Link>
    </div>
  );
}
