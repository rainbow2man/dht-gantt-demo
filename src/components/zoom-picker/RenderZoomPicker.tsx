import { gantt } from "dhtmlx-gantt";
import { zoomLevels } from "../../config";
import { Button } from "antd";
import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";

const RenderZoomPicker = forwardRef((props, ref) => {
  useEffect(() => setZooms(), []);
  const [curZoom, setCurZoom] = useState("day");
  const _curZoom = useRef("day");

  // 给父组件调用的
  // 此处注意useImperativeHandle方法的的第一个参数是目标元素的ref引用
  useImperativeHandle(ref, () => ({
    // 以下是父组件可以使用的方法/属性
    _curZoom,
  }));

  //PASS 初始化设置 时间刻度范围 以及 时间刻度具体数值 以及 初始时间刻度
  function setZooms() {
    const zoomConfig = {
      levels: zoomLevels,
      trigger: "wheel",
      element: () => {
        return gantt.$root.querySelector(".gantt_task");
      },
    };
    // 初始化
    gantt.ext.zoom.init(zoomConfig);
    // 设置初始缩放等级
    gantt.ext.zoom.setLevel("day");
  }

  //PASS 变更 时间刻度视图
  function handleChangeZoom(zoom) {
    setCurZoom(zoom);
    _curZoom.current = zoom;
    gantt.ext.zoom.setLevel(zoom);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {zoomLevels.map((item) => {
        return (
          <Button
            key={item.name}
            type="primary"
            disabled={item.name === curZoom}
            onClick={() => {
              handleChangeZoom(item.name);
            }}
            style={{ marginRight: 6 }}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
});

export default RenderZoomPicker;
