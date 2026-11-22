import cinMark from '../assets/cin-mark.png';

export default function Brand({ detail, light = false }) {
  return (
    <div className={`brand-lockup${light ? ' brand-lockup--light' : ''}`}>
      <img className="brand-mark" src={cinMark} alt="" aria-hidden="true" />
      <span>
        Matrículas <strong>CIn</strong>
      </span>
      {detail && <small>{detail}</small>}
    </div>
  );
}
