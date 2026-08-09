import { useNavigate } from "react-router-dom";

export default function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" className="btn back-button" onClick={() => navigate(-1)}>
      ← 回上一頁
    </button>
  );
}
