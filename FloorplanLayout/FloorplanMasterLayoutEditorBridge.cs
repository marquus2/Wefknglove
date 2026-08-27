#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

public static class FloorplanMasterLayoutEditorBridge
{
    public static string ResolveJsonPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return string.Empty;

        path = path.Replace("\\", "/");
        if (Path.IsPathRooted(path))
            return path;

        if (path.StartsWith("Assets/", StringComparison.OrdinalIgnoreCase))
            return Path.GetFullPath(Path.Combine(Application.dataPath, "..", path));

        return Path.GetFullPath(path);
    }

    public static void ApplyJsonToScenes(FloorplanMasterLayout layout)
    {
        ApplyJsonToScenes(layout, layout != null && layout.openSecondaryScenesAdditive, layout != null && layout.saveModifiedScenes, true);
    }

    public static int ApplyAllOpenLayouts(bool includeSceneLoading, bool saveModifiedScenes, bool openedEventOnly, string reason)
    {
        int total = 0;
        foreach (FloorplanMasterLayout layout in FindSceneObjects<FloorplanMasterLayout>())
        {
            if (layout == null) continue;
            if (openedEventOnly && !layout.autoApplyOnSceneOpened) continue;
            if (!openedEventOnly && !layout.autoApplyBeforeSceneSave) continue;
            total += ApplyJsonToScenes(layout, includeSceneLoading, saveModifiedScenes, false);
        }

        if (total > 0)
            Debug.Log("[FloorplanMasterLayout] Auto applied " + total.ToString(CultureInfo.InvariantCulture) + " bindings. Reason: " + reason);

        return total;
    }

    public static void WriteOpenSceneLayoutToJson(FloorplanMasterLayout layout)
    {
        if (layout == null) return;

        string json = layout.JsonText;
        string path = ResolveJsonPath(layout.jsonFilePath);
        if (string.IsNullOrWhiteSpace(path))
        {
            SetReport(layout, "Json File Path is required when writing changes back.");
            return;
        }

        if (string.IsNullOrWhiteSpace(json))
        {
            SetReport(layout, "No JSON available to update.");
            return;
        }

        JObject root;
        try { root = JObject.Parse(json); }
        catch (Exception ex)
        {
            SetReport(layout, "JSON parse failed:\n" + ex.Message);
            return;
        }

        int levels = WriteLevels(layout, root);
        int paths = WritePaths(layout, root);

        Directory.CreateDirectory(Path.GetDirectoryName(path) ?? Application.dataPath);
        File.WriteAllText(path, root.ToString(Formatting.Indented));
        AssetDatabase.Refresh();

        SetReport(layout,
            "Wrote open scene layout to JSON\n" +
            "File: " + path + "\n" +
            "Levels: " + levels.ToString(CultureInfo.InvariantCulture) + "\n" +
            "Paths: " + paths.ToString(CultureInfo.InvariantCulture));
    }

    public static bool ApplyPathBinding(FloorplanMasterLayout layout, FloorplanPathBinding binding, out string report)
    {
        report = string.Empty;
        if (layout == null)
        {
            report = "No FloorplanMasterLayout available.";
            return false;
        }

        if (binding == null)
        {
            report = "No FloorplanPathBinding selected.";
            return false;
        }

        if (!TryParseJson(layout, out JObject root, out report))
            return false;

        JArray paths = root["paths"] as JArray;
        if (paths == null)
        {
            report = "The JSON has no paths array.";
            return false;
        }

        foreach (JObject path in paths.OfType<JObject>())
        {
            string id = StringValue(path["id"]);
            string acId = StringValue(path["acId"]);
            string routeKey = StringValue(path["routeKey"]);
            string from = StringValue(path["from"]);
            string to = StringValue(path["to"]);

            if (!binding.Matches(id, acId, routeKey, from, to))
                continue;

            bool applied = ApplyPathObjectToBinding(layout, path, binding, out report);
            if (applied)
                SetReport(layout, report);
            return applied;
        }

        report = "No matching path found for " + binding.pathId + ".";
        return false;
    }

    public static bool ApplyLevelBinding(FloorplanMasterLayout layout, FloorplanLevelBinding binding, out string report)
    {
        report = string.Empty;
        if (layout == null || binding == null)
        {
            report = "No Master Layout or Level Binding available.";
            return false;
        }

        if (!TryParseJson(layout, out JObject root, out report))
            return false;

        JArray rects = root["rects"] as JArray;
        JObject rect = rects?.OfType<JObject>().FirstOrDefault(r => StringValue(r["id"]) == binding.floorplanId);
        if (rect == null)
        {
            report = "No matching scene found for " + binding.floorplanId + ".";
            return false;
        }

        ApplyRectObjectToBinding(layout, rect, binding);
        report = "Applied level " + binding.floorplanId + " to " + binding.name + ".";
        SetReport(layout, report);
        return true;
    }

    private static int ApplyJsonToScenes(FloorplanMasterLayout layout, bool openConfiguredScenes, bool saveDirtyScenes, bool updateReport)
    {
        if (layout == null)
            return 0;

        if (!TryParseJson(layout, out JObject root, out string error))
        {
            if (updateReport) SetReport(layout, error);
            return 0;
        }

        var openedScenes = new List<Scene>();
        if (openConfiguredScenes)
            openedScenes.AddRange(OpenConfiguredScenes(layout));

        int levelsApplied = ApplyLevels(layout, root);
        int pathsApplied = ApplyPaths(layout, root);

        if (saveDirtyScenes)
            SaveDirtyScenes();

        if (updateReport)
        {
            SetReport(layout,
                "Applied floorplan JSON\n" +
                "Levels: " + levelsApplied.ToString(CultureInfo.InvariantCulture) + "\n" +
                "Paths: " + pathsApplied.ToString(CultureInfo.InvariantCulture) + "\n" +
                "Opened scenes: " + openedScenes.Count.ToString(CultureInfo.InvariantCulture));
        }

        return levelsApplied + pathsApplied;
    }

    private static bool TryParseJson(FloorplanMasterLayout layout, out JObject root, out string error)
    {
        root = null;
        error = string.Empty;

        string json = layout != null ? layout.JsonText : string.Empty;
        if (string.IsNullOrWhiteSpace(json))
        {
            error = "No JSON assigned. Add a TextAsset or a valid Json File Path.";
            return false;
        }

        try
        {
            root = JObject.Parse(json);
            return true;
        }
        catch (Exception ex)
        {
            error = "JSON parse failed:\n" + ex.Message;
            return false;
        }
    }

    private static IEnumerable<Scene> OpenConfiguredScenes(FloorplanMasterLayout layout)
    {
        var opened = new List<Scene>();
        foreach (string scenePath in layout.secondaryScenePaths)
        {
            if (string.IsNullOrWhiteSpace(scenePath)) continue;
            if (IsSceneLoaded(scenePath)) continue;
            if (!File.Exists(ResolveJsonPath(scenePath)) && !File.Exists(scenePath)) continue;

            Scene scene = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Additive);
            if (scene.IsValid()) opened.Add(scene);
        }
        return opened;
    }

    private static bool IsSceneLoaded(string scenePath)
    {
        for (int i = 0; i < SceneManager.sceneCount; i++)
        {
            Scene scene = SceneManager.GetSceneAt(i);
            if (scene.path == scenePath && scene.isLoaded)
                return true;
        }
        return false;
    }

    private static int ApplyLevels(FloorplanMasterLayout layout, JObject root)
    {
        JArray rects = root["rects"] as JArray;
        if (rects == null) return 0;

        var bindings = FindSceneObjects<FloorplanLevelBinding>()
            .Concat(layout.levelBindings.Where(b => b != null))
            .GroupBy(b => b)
            .Select(g => g.Key)
            .Where(b => !string.IsNullOrWhiteSpace(b.floorplanId))
            .ToList();

        int count = 0;
        foreach (JObject rect in rects.OfType<JObject>())
        {
            string id = StringValue(rect["id"]);
            if (string.IsNullOrWhiteSpace(id)) continue;

            FloorplanLevelBinding binding = bindings.FirstOrDefault(b => b.floorplanId == id);
            if (binding == null) continue;

            ApplyRectObjectToBinding(layout, rect, binding);
            count++;
        }

        return count;
    }

    private static void ApplyRectObjectToBinding(FloorplanMasterLayout layout, JObject rect, FloorplanLevelBinding binding)
    {
        float x = FloatValue(rect["position"]?["x"] ?? rect["x"]);
        float y = FloatValue(rect["position"]?["y"] ?? rect["y"]);
        float dir = FloatValue(rect["dir"]);

        Transform target = binding.Target;
        Undo.RecordObject(target, "Apply Floorplan Level");
        Vector3 world = layout.coordinates.JsonPointToWorld(x, y, target.position.y);
        Quaternion rotation = layout.coordinates.JsonYawToWorldRotation(dir);
        binding.ApplyPose(world, rotation);
        EditorUtility.SetDirty(target);
        EditorSceneManager.MarkSceneDirty(target.gameObject.scene);
        SceneView.RepaintAll();
    }

    private static int ApplyPaths(FloorplanMasterLayout layout, JObject root)
    {
        JArray paths = root["paths"] as JArray;
        if (paths == null) return 0;

        var bindings = FindSceneObjects<FloorplanPathBinding>()
            .Concat(layout.pathBindings.Where(b => b != null))
            .GroupBy(b => b)
            .Select(g => g.Key)
            .ToList();

        int count = 0;
        foreach (JObject path in paths.OfType<JObject>())
        {
            string id = StringValue(path["id"]);
            string acId = StringValue(path["acId"]);
            string routeKey = StringValue(path["routeKey"]);
            string from = StringValue(path["from"]);
            string to = StringValue(path["to"]);

            foreach (FloorplanPathBinding binding in bindings.Where(b => b.Matches(id, acId, routeKey, from, to)))
                if (ApplyPathObjectToBinding(layout, path, binding, out _))
                    count++;
        }

        return count;
    }

    private static bool ApplyPathObjectToBinding(FloorplanMasterLayout layout, JObject path, FloorplanPathBinding binding, out string report)
    {
        report = string.Empty;
        JArray nodeArray = SelectNodeArray(path, binding.laneIndex);
        if (nodeArray == null || nodeArray.Count == 0)
        {
            report = "The selected path has no nodes for the selected lane.";
            return false;
        }

        var worldNodes = new List<Vector3>(nodeArray.Count);
        foreach (JObject node in nodeArray.OfType<JObject>())
        {
            float x = FloatValue(node["x"]);
            float y = FloatValue(node["y"]);
            float height = binding.polyline != null ? binding.polyline.transform.position.y : binding.transform.position.y;
            worldNodes.Add(layout.coordinates.JsonPointToWorld(x, y, height));
        }

        Undo.RecordObject(binding, "Apply Floorplan Path");
        if (binding.polyline != null)
        {
            Undo.RecordObject(binding.polyline, "Apply Floorplan Path");
            Undo.RecordObject(binding.polyline.gameObject, "Apply Floorplan Path");
        }

        binding.ApplyWorldNodes(worldNodes);

        EditorUtility.SetDirty(binding);
        if (binding.polyline != null)
        {
            EditorUtility.SetDirty(binding.polyline);
            EditorUtility.SetDirty(binding.polyline.gameObject);
        }
        EditorSceneManager.MarkSceneDirty(binding.gameObject.scene);
        SceneView.RepaintAll();

        report = "Applied path " + StringValue(path["id"]) +
                 " lane " + (binding.laneIndex < 0 ? "unified" : (binding.laneIndex + 1).ToString(CultureInfo.InvariantCulture)) +
                 " to " + binding.name +
                 " (" + nodeArray.Count.ToString(CultureInfo.InvariantCulture) + " points).";
        return true;
    }

    private static int WriteLevels(FloorplanMasterLayout layout, JObject root)
    {
        JArray rects = root["rects"] as JArray;
        if (rects == null) return 0;

        var bindings = FindSceneObjects<FloorplanLevelBinding>()
            .Concat(layout.levelBindings.Where(b => b != null))
            .GroupBy(b => b)
            .Select(g => g.Key)
            .Where(b => !string.IsNullOrWhiteSpace(b.floorplanId))
            .ToList();

        int count = 0;
        foreach (FloorplanLevelBinding binding in bindings)
        {
            JObject rect = rects.OfType<JObject>().FirstOrDefault(r => StringValue(r["id"]) == binding.floorplanId);
            if (rect == null) continue;

            Transform target = binding.Target;
            Vector2 jsonPos = layout.coordinates.WorldPointToJson(target.position - binding.worldOffset);
            rect["position"] = new JObject
            {
                ["x"] = Round(jsonPos.x),
                ["y"] = Round(jsonPos.y)
            };
            if (rect["x"] != null) rect["x"] = Round(jsonPos.x);
            if (rect["y"] != null) rect["y"] = Round(jsonPos.y);

            Quaternion unoffsetRotation = target.rotation * Quaternion.Inverse(Quaternion.Euler(binding.rotationOffsetEuler));
            rect["dir"] = Round(layout.coordinates.WorldRotationToJsonYaw(unoffsetRotation));
            count++;
        }

        return count;
    }

    private static int WritePaths(FloorplanMasterLayout layout, JObject root)
    {
        JArray paths = root["paths"] as JArray;
        if (paths == null)
        {
            paths = new JArray();
            root["paths"] = paths;
        }

        var bindings = FindSceneObjects<FloorplanPathBinding>()
            .Concat(layout.pathBindings.Where(b => b != null))
            .GroupBy(b => b)
            .Select(g => g.Key)
            .ToList();

        int count = 0;
        foreach (FloorplanPathBinding binding in bindings)
        {
            if (binding == null) continue;
            string id = !string.IsNullOrWhiteSpace(binding.pathId) ? binding.pathId : BuildPathId(binding);
            if (string.IsNullOrWhiteSpace(id)) continue;

            JObject path = paths.OfType<JObject>().FirstOrDefault(p =>
                StringValue(p["id"]) == id ||
                (!string.IsNullOrWhiteSpace(binding.routeKey) && StringValue(p["routeKey"]) == binding.routeKey));

            if (path == null)
            {
                path = new JObject();
                paths.Add(path);
            }

            path["id"] = id;
            if (!string.IsNullOrWhiteSpace(binding.alternateContentId)) path["acId"] = binding.alternateContentId;
            if (!string.IsNullOrWhiteSpace(binding.routeKey)) path["routeKey"] = binding.routeKey;
            if (!string.IsNullOrWhiteSpace(binding.fromSceneId)) path["from"] = binding.fromSceneId;
            if (!string.IsNullOrWhiteSpace(binding.toSceneId)) path["to"] = binding.toSceneId;

            JArray nodes = WorldNodesToJson(layout, binding.GetWorldNodes());
            if (binding.laneIndex >= 0)
            {
                JArray lanes = path["lanes"] as JArray ?? new JArray();
                while (lanes.Count <= binding.laneIndex) lanes.Add(new JArray());
                lanes[binding.laneIndex] = nodes;
                path["lanes"] = lanes;
            }
            else
            {
                path["nodes"] = nodes;
            }

            UpdateRegularConnectionNodes(root, binding, nodes);
            count++;
        }

        return count;
    }

    private static JArray SelectNodeArray(JObject path, int laneIndex)
    {
        if (laneIndex >= 0)
        {
            JArray lanes = path["lanes"] as JArray;
            if (lanes != null && laneIndex < lanes.Count)
                return lanes[laneIndex] as JArray;
        }

        return path["nodes"] as JArray;
    }

    private static JArray WorldNodesToJson(FloorplanMasterLayout layout, List<Vector3> worldNodes)
    {
        var result = new JArray();
        foreach (Vector3 world in worldNodes)
        {
            Vector2 p = layout.coordinates.WorldPointToJson(world);
            result.Add(new JObject
            {
                ["x"] = Round(p.x),
                ["y"] = Round(p.y)
            });
        }
        return result;
    }

    private static void UpdateRegularConnectionNodes(JObject root, FloorplanPathBinding binding, JArray nodes)
    {
        if (binding == null || string.IsNullOrWhiteSpace(binding.pathId))
            return;

        JArray connections = root["connections"] as JArray;
        if (connections == null) return;

        JObject connection = connections.OfType<JObject>().FirstOrDefault(c => StringValue(c["id"]) == binding.pathId);
        if (connection == null) return;

        if (binding.laneIndex >= 0)
        {
            JArray lanes = connection["lanes"] as JArray ?? new JArray();
            while (lanes.Count <= binding.laneIndex) lanes.Add(new JArray());
            lanes[binding.laneIndex] = nodes;
            connection["lanes"] = lanes;
        }
        else
        {
            connection["nodes"] = nodes;
        }
    }

    private static string BuildPathId(FloorplanPathBinding binding)
    {
        if (!string.IsNullOrWhiteSpace(binding.routeKey))
            return "path-" + binding.routeKey;
        if (!string.IsNullOrWhiteSpace(binding.fromSceneId) && !string.IsNullOrWhiteSpace(binding.toSceneId))
            return "path-" + binding.fromSceneId + "-" + binding.toSceneId;
        return string.Empty;
    }

    private static IEnumerable<T> FindSceneObjects<T>() where T : Component
    {
        return Resources.FindObjectsOfTypeAll<T>()
            .Where(c => c != null &&
                        c.gameObject.scene.IsValid() &&
                        c.gameObject.scene.isLoaded &&
                        !EditorUtility.IsPersistent(c));
    }

    private static void SaveDirtyScenes()
    {
        for (int i = 0; i < SceneManager.sceneCount; i++)
        {
            Scene scene = SceneManager.GetSceneAt(i);
            if (scene.isLoaded && scene.isDirty)
                EditorSceneManager.SaveScene(scene);
        }
    }

    private static void SetReport(FloorplanMasterLayout layout, string report)
    {
        Undo.RecordObject(layout, "Update Floorplan Layout Report");
        layout.lastReport = report;
        EditorUtility.SetDirty(layout);
        Debug.Log("[FloorplanMasterLayout] " + report, layout);
    }

    private static string StringValue(JToken token)
    {
        return token == null ? string.Empty : token.Value<string>() ?? string.Empty;
    }

    private static float FloatValue(JToken token)
    {
        return token == null ? 0f : token.Value<float>();
    }

    private static float Round(float value)
    {
        return Mathf.Round(value * 1000f) / 1000f;
    }
}
#endif
