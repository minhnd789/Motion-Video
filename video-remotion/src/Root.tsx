import { CalculateMetadataFunction, Composition } from "remotion";
import { MainVideo, MainVideoProps } from "./engine/MainVideo";
import { emptyProject, projectDuration } from "./engine/types";

// Kích thước, fps và thời lượng lấy từ JSON dự án truyền vào qua props.
const calculateMetadata: CalculateMetadataFunction<MainVideoProps> = ({ props }) => ({
  durationInFrames: projectDuration(props.project),
  fps: props.project.fps,
  width: props.project.width,
  height: props.project.height,
  defaultOutName: props.project.id,
});

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={MainVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ project: emptyProject() }}
      calculateMetadata={calculateMetadata}
    />
  );
};
