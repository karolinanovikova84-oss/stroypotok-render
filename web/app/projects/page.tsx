import Link from "next/link";

export default function ProjectsPage() {
  return (
    <div className="authShell">
      <h1>Объекты доступны в кабинете</h1>
      <Link className="button" href="/cabinet">
        Открыть кабинет
      </Link>
    </div>
  );
}
