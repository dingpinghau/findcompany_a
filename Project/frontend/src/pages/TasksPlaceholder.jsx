import BackButton from "../components/BackButton";

export default function TasksPlaceholder() {
  return (
    <div>
      <BackButton />
      <div className="page-header">
        <h1>Task</h1>
      </div>
      <p className="muted">開發中，敬請期待。</p>
    </div>
  );
}
