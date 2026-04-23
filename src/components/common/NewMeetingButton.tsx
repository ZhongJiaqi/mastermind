interface Props {
  onClick: () => void;
}

export function NewMeetingButton({ onClick }: Props) {
  return (
    <div className="pt-4 border-t border-stone-200">
      <button
        onClick={onClick}
        className="w-full py-3 bg-white border border-stone-300 rounded-xl text-stone-700 font-medium hover:bg-stone-50"
      >
        开新会议
      </button>
    </div>
  );
}
