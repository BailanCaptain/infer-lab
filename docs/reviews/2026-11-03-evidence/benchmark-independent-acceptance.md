# 推理测量计时增量独立复核

完整阅读 `benchmark-citation-remediation.diff`，并实际读取 vLLM ced6857a endpoint_request_func.py 402–434、526–561、606–639，以及0fc695fc同文件154–264、337–427。

ced 的 chat/audio 都以非空 choices 数组分支推进 most_recent_timestamp，并仅在至少进入一次该分支后标记成功；content 可为空。旧版 chat 在所有非 DONE 的 JSON 片段后推进时间，HTTP 200 流正常结束即成功；旧 completions 则已有 first_chunk_received 检查。当前文准确区分这几条路径，没有把 choices 当作可见文本。pooling 路径先耗尽 bytes 流或读取 body 后计时，依据也成立。

未发现增量新增 P1/P2。本次仅核上述改动和对应执行代码，未重复 root 的全页15来源及图审查；未运行服务、浏览器 UI 或性能测试。
