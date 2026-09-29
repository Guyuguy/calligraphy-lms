import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
	/** 已录制完成的音频 blob URL（用于回放） */
	audioUrl: string | null;
	/** 录音完成时回调，传出 blob 本身供上传 */
	onRecorded: (blob: Blob) => void;
	/** 清除录音 */
	onClear: () => void;
	/** 上传中状态 */
	uploading?: boolean;
}

export function AudioRecorder({
	audioUrl,
	onRecorded,
	onClear,
	uploading = false,
}: AudioRecorderProps) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const [recording, setRecording] = useState(false);
	const [seconds, setSeconds] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (mediaRecorderRef.current?.state === "recording") {
				mediaRecorderRef.current.stop();
			}
		};
	}, []);

	const startTimer = () => {
		setSeconds(0);
		timerRef.current = setInterval(() => {
			setSeconds((s) => s + 1);
		}, 1000);
	};

	const stopTimer = () => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	};

	const startRecording = async () => {
		setError(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mime = pickMime();
			const recorder = new MediaRecorder(
				stream,
				mime ? { mimeType: mime } : undefined,
			);
			chunksRef.current = [];
			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};
			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, {
					type: mime || "audio/webm",
				});
				onRecorded(blob);
				for (const t of stream.getTracks()) t.stop();
			};
			recorder.start();
			mediaRecorderRef.current = recorder;
			setRecording(true);
			startTimer();
		} catch (e) {
			setError(
				e instanceof Error
					? `无法访问麦克风：${e.message}`
					: "无法访问麦克风，请检查权限",
			);
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.stop();
		}
		setRecording(false);
		stopTimer();
	};

	const handleMouseDown = () => {
		if (uploading) return;
		startRecording();
	};

	const handleMouseUp = () => {
		if (recording) stopRecording();
	};

	const handleMouseLeave = () => {
		// 鼠标离开按钮也视为结束录音
		if (recording) stopRecording();
	};

	// 触摸事件
	const handleTouchStart = (e: React.TouchEvent) => {
		e.preventDefault();
		if (uploading) return;
		startRecording();
	};
	const handleTouchEnd = (e: React.TouchEvent) => {
		e.preventDefault();
		if (recording) stopRecording();
	};

	const formatTime = (s: number) => {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<button
					type="button"
					onMouseDown={handleMouseDown}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					onTouchStart={handleTouchStart}
					onTouchEnd={handleTouchEnd}
					disabled={uploading}
					className={cn(
						"relative flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors select-none",
						recording
							? "border-status-error bg-status-error text-white"
							: "border-brand bg-brand/5 text-brand hover:bg-brand/10",
						uploading && "opacity-50 cursor-not-allowed",
					)}
				>
					{recording ? (
						<>
							<Square className="size-4" />
							松开结束
							<span className="ml-1 tabular-nums">{formatTime(seconds)}</span>
						</>
					) : (
						<>
							<Mic className="size-4" />
							按住说话
						</>
					)}
				</button>
				{uploading && (
					<span className="text-xs text-text-muted">上传中...</span>
				)}
			</div>

			{error && <div className="text-xs text-status-error">{error}</div>}

			{audioUrl && !recording && (
				<div className="flex items-center gap-2 rounded-md border border-border bg-surface-1 p-2">
					<audio controls src={audioUrl} className="h-8 flex-1">
						<track kind="captions" />
					</audio>
					<button
						type="button"
						onClick={onClear}
						disabled={uploading}
						className="text-xs text-status-error hover:underline disabled:opacity-50"
					>
						删除重录
					</button>
				</div>
			)}

			{!audioUrl && !recording && (
				<div className="text-xs text-text-muted">
					按住按钮开始录音，松开自动上传并保存
				</div>
			)}
		</div>
	);
}

function pickMime(): string | undefined {
	if (typeof MediaRecorder === "undefined") return undefined;
	const candidates = [
		"audio/webm;codecs=opus",
		"audio/webm",
		"audio/mp4",
		"audio/ogg;codecs=opus",
	];
	for (const m of candidates) {
		if (MediaRecorder.isTypeSupported?.(m)) return m;
	}
	return undefined;
}
