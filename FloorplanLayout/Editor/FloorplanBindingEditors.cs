#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;

[CustomEditor(typeof(FloorplanLevelBinding))]
public class FloorplanLevelBindingEditor : Editor
{
    public override void OnInspectorGUI()
    {
        var binding = (FloorplanLevelBinding)target;
        serializedObject.Update();

        EditorGUILayout.LabelField("Floorplan Level Binding", EditorStyles.boldLabel);
        EditorGUILayout.HelpBox("Choose the SAMBO scene from the JSON. This object, or Target Root, will move to that scene position.", MessageType.Info);

        binding.masterLayout = (FloorplanMasterLayout)EditorGUILayout.ObjectField("Master Layout", binding.masterLayout, typeof(FloorplanMasterLayout), true);
        FloorplanMasterLayout layout = FloorplanBindingEditorUtility.ResolveMaster(binding.masterLayout);

        if (layout == null)
        {
            EditorGUILayout.HelpBox("No FloorplanMasterLayout found in the open scenes.", MessageType.Warning);
        }
        else if (FloorplanBindingEditorUtility.TryReadRoot(layout, out JObject root, out string error))
        {
            DrawScenePopup(binding, root);
            using (new EditorGUI.DisabledScope(string.IsNullOrWhiteSpace(binding.floorplanId)))
            {
                if (GUILayout.Button("Apply Selected Level", GUILayout.Height(26)))
                    ApplySelectedLevel(layout, binding);
            }
        }
        else
        {
            EditorGUILayout.HelpBox(error, MessageType.Warning);
        }

        EditorGUILayout.Space(6);
        DrawPropertiesExcluding(serializedObject, "m_Script", "masterLayout", "floorplanId");
        serializedObject.ApplyModifiedProperties();

        if (GUI.changed)
            EditorUtility.SetDirty(binding);
    }

    private static void DrawScenePopup(FloorplanLevelBinding binding, JObject root)
    {
        List<FloorplanBindingEditorUtility.SceneOption> scenes = FloorplanBindingEditorUtility.GetScenes(root);
        string[] labels = scenes.Select(s => s.Label).ToArray();
        int index = Mathf.Max(0, scenes.FindIndex(s => s.Id == binding.floorplanId));
        int next = EditorGUILayout.Popup("Scene", index, labels);
        if (next >= 0 && next < scenes.Count)
            binding.floorplanId = scenes[next].Id;
    }

    private static void ApplySelectedLevel(FloorplanMasterLayout layout, FloorplanLevelBinding binding)
    {
        if (!FloorplanMasterLayoutEditorBridge.ApplyLevelBinding(layout, binding, out string report))
            Debug.LogWarning("[FloorplanLevelBinding] " + report, binding);
        else
            Debug.Log("[FloorplanLevelBinding] " + report, binding);
    }
}

[CustomEditor(typeof(FloorplanPathBinding))]
public class FloorplanPathBindingEditor : Editor
{
    public override void OnInspectorGUI()
    {
        var binding = (FloorplanPathBinding)target;
        serializedObject.Update();

        EditorGUILayout.LabelField("Floorplan Path Binding", EditorStyles.boldLabel);
        EditorGUILayout.HelpBox("Choose the owner scene/alternate-content and then choose one path from the JSON. The fields below are filled automatically.", MessageType.Info);

        binding.masterLayout = (FloorplanMasterLayout)EditorGUILayout.ObjectField("Master Layout", binding.masterLayout, typeof(FloorplanMasterLayout), true);
        FloorplanMasterLayout layout = FloorplanBindingEditorUtility.ResolveMaster(binding.masterLayout);

        bool pickerChanged = false;
        if (layout == null)
        {
            EditorGUILayout.HelpBox("No FloorplanMasterLayout found in the open scenes.", MessageType.Warning);
        }
        else if (FloorplanBindingEditorUtility.TryReadRoot(layout, out JObject root, out string error))
        {
            EditorGUI.BeginChangeCheck();
            DrawJsonPickers(binding, root);
            pickerChanged = EditorGUI.EndChangeCheck();
        }
        else
        {
            EditorGUILayout.HelpBox(error, MessageType.Warning);
        }

        EditorGUILayout.Space(6);
        DrawPolylineTools(binding);

        using (new EditorGUI.DisabledScope(layout == null || binding.polyline == null || string.IsNullOrWhiteSpace(binding.pathId)))
        {
            if (GUILayout.Button("Apply Selected Path To Polyline", GUILayout.Height(28)))
                ApplySelectedPath(layout, binding);
        }

        EditorGUILayout.Space(6);
        DrawPropertiesExcluding(serializedObject,
            "m_Script",
            "masterLayout",
            "pathId",
            "alternateContentId",
            "routeKey",
            "fromSceneId",
            "toSceneId",
            "laneIndex",
            "polyline");
        serializedObject.ApplyModifiedProperties();

        if (GUI.changed)
            EditorUtility.SetDirty(binding);

        if (pickerChanged && layout != null && binding.polyline != null && !string.IsNullOrWhiteSpace(binding.pathId))
            ApplySelectedPath(layout, binding);
    }

    private static void DrawJsonPickers(FloorplanPathBinding binding, JObject root)
    {
        List<FloorplanBindingEditorUtility.SceneOption> scenes = FloorplanBindingEditorUtility.GetScenes(root);
        if (scenes.Count == 0)
        {
            EditorGUILayout.HelpBox("The JSON has no rects/scenes.", MessageType.Warning);
            return;
        }

        string currentSceneId = !string.IsNullOrWhiteSpace(binding.alternateContentId)
            ? binding.alternateContentId
            : binding.fromSceneId;

        int sceneIndex = scenes.FindIndex(s => s.Id == currentSceneId);
        if (sceneIndex < 0) sceneIndex = Mathf.Max(0, scenes.FindIndex(s => s.Kind == "alternate-content"));
        if (sceneIndex < 0) sceneIndex = 0;

        string[] sceneLabels = scenes.Select(s => s.Label).ToArray();
        int nextScene = EditorGUILayout.Popup("Scene / AC", sceneIndex, sceneLabels);
        string sceneId = scenes[nextScene].Id;

        List<FloorplanBindingEditorUtility.PathOption> paths = FloorplanBindingEditorUtility.GetPaths(root, sceneId);
        if (paths.Count == 0)
        {
            EditorGUILayout.HelpBox("No paths found for this scene.", MessageType.Warning);
            binding.alternateContentId = sceneId;
            return;
        }

        int pathIndex = paths.FindIndex(p => p.Id == binding.pathId || p.RouteKey == binding.routeKey);
        if (pathIndex < 0) pathIndex = 0;

        string[] pathLabels = paths.Select(p => p.Label).ToArray();
        int nextPath = EditorGUILayout.Popup("Path", pathIndex, pathLabels);
        FloorplanBindingEditorUtility.PathOption selectedPath = paths[nextPath];
        ApplyPathOption(binding, selectedPath);

        DrawLanePopup(binding, selectedPath);

        using (new EditorGUI.DisabledScope(true))
        {
            EditorGUILayout.TextField("Path Id", binding.pathId);
            EditorGUILayout.TextField("Route Key", binding.routeKey);
            EditorGUILayout.TextField("From", binding.fromSceneId);
            EditorGUILayout.TextField("To", binding.toSceneId);
        }
    }

    private static void DrawLanePopup(FloorplanPathBinding binding, FloorplanBindingEditorUtility.PathOption selectedPath)
    {
        if (selectedPath.LaneCount <= 1)
        {
            binding.laneIndex = -1;
            using (new EditorGUI.DisabledScope(true))
                EditorGUILayout.Popup("Lane", 0, new[] { "Unified path" });
            return;
        }

        string[] labels = Enumerable.Range(0, selectedPath.LaneCount)
            .Select(i => "Lane " + (i + 1).ToString())
            .ToArray();
        int index = Mathf.Clamp(binding.laneIndex, 0, selectedPath.LaneCount - 1);
        binding.laneIndex = EditorGUILayout.Popup("Lane", index, labels);
    }

    private static void ApplyPathOption(FloorplanPathBinding binding, FloorplanBindingEditorUtility.PathOption path)
    {
        binding.pathId = path.Id;
        binding.alternateContentId = path.AcId;
        binding.routeKey = path.RouteKey;
        binding.fromSceneId = path.From;
        binding.toSceneId = path.To;

        if (path.LaneCount <= 1)
            binding.laneIndex = -1;
        else if (binding.laneIndex < 0 || binding.laneIndex >= path.LaneCount)
            binding.laneIndex = 0;
    }

    private static void DrawPolylineTools(FloorplanPathBinding binding)
    {
        binding.polyline = (Shapes.Polyline)EditorGUILayout.ObjectField("Polyline", binding.polyline, typeof(Shapes.Polyline), true);

        using (new EditorGUILayout.HorizontalScope())
        {
            if (GUILayout.Button("Find Polyline"))
            {
                Undo.RecordObject(binding, "Find Polyline");
                binding.polyline = binding.GetComponent<Shapes.Polyline>() ?? binding.GetComponentInChildren<Shapes.Polyline>(true);
                EditorUtility.SetDirty(binding);
            }

            using (new EditorGUI.DisabledScope(binding.polyline == null))
            {
                if (GUILayout.Button("Select Polyline"))
                    Selection.activeObject = binding.polyline;
            }
        }
    }

    private static void ApplySelectedPath(FloorplanMasterLayout layout, FloorplanPathBinding binding)
    {
        if (!FloorplanMasterLayoutEditorBridge.ApplyPathBinding(layout, binding, out string report))
            Debug.LogWarning("[FloorplanPathBinding] " + report, binding);
        else
            Debug.Log("[FloorplanPathBinding] " + report, binding);
    }
}

internal static class FloorplanBindingEditorUtility
{
    public struct SceneOption
    {
        public string Id;
        public string Name;
        public string Kind;
        public string Label;
    }

    public struct PathOption
    {
        public string Id;
        public string AcId;
        public string RouteKey;
        public string From;
        public string To;
        public string Mode;
        public int LaneCount;
        public string Label;
    }

    public static FloorplanMasterLayout ResolveMaster(FloorplanMasterLayout explicitMaster)
    {
        if (explicitMaster != null)
            return explicitMaster;

        return Resources.FindObjectsOfTypeAll<FloorplanMasterLayout>()
            .FirstOrDefault(m => m != null &&
                                 m.gameObject.scene.IsValid() &&
                                 m.gameObject.scene.isLoaded &&
                                 !EditorUtility.IsPersistent(m));
    }

    public static bool TryReadRoot(FloorplanMasterLayout layout, out JObject root, out string error)
    {
        root = null;
        error = string.Empty;

        if (layout == null)
        {
            error = "No Master Layout assigned.";
            return false;
        }

        string json = layout.JsonText;
        if (string.IsNullOrWhiteSpace(json))
        {
            error = "The Master Layout has no JSON assigned.";
            return false;
        }

        try
        {
            root = JObject.Parse(json);
            return true;
        }
        catch (Exception ex)
        {
            error = "JSON parse failed: " + ex.Message;
            return false;
        }
    }

    public static List<SceneOption> GetScenes(JObject root)
    {
        return (root["rects"] as JArray)?
            .OfType<JObject>()
            .Select(r =>
            {
                string id = Value(r["id"]);
                string name = Value(r["name"]);
                string kind = Value(r["kind"]);
                return new SceneOption
                {
                    Id = id,
                    Name = name,
                    Kind = kind,
                    Label = id + "  |  " + CleanName(name) + "  |  " + kind
                };
            })
            .Where(s => !string.IsNullOrWhiteSpace(s.Id))
            .ToList() ?? new List<SceneOption>();
    }

    public static List<PathOption> GetPaths(JObject root, string sceneId)
    {
        return (root["paths"] as JArray)?
            .OfType<JObject>()
            .Where(p => PathBelongsToScene(p, sceneId))
            .Select(ToPathOption)
            .Where(p => !string.IsNullOrWhiteSpace(p.Id))
            .ToList() ?? new List<PathOption>();
    }

    private static PathOption ToPathOption(JObject p)
    {
        string id = Value(p["id"]);
        string acId = Value(p["acId"]);
        string routeKey = Value(p["routeKey"]);
        string from = Value(p["from"]);
        string to = Value(p["to"]);
        string mode = Value(p["mode"]);
        int laneCount = (p["lanes"] as JArray)?.Count ?? 0;
        if (laneCount <= 0 && p["nodes"] is JArray) laneCount = 1;

        return new PathOption
        {
            Id = id,
            AcId = acId,
            RouteKey = routeKey,
            From = from,
            To = to,
            Mode = mode,
            LaneCount = laneCount,
            Label = BuildPathLabel(id, acId, routeKey, from, to, mode, laneCount)
        };
    }

    private static bool PathBelongsToScene(JObject p, string sceneId)
    {
        if (string.IsNullOrWhiteSpace(sceneId)) return true;
        return Value(p["acId"]) == sceneId ||
               Value(p["from"]) == sceneId ||
               Value(p["to"]) == sceneId ||
               Value(p["routeKey"]).Contains(sceneId);
    }

    private static string BuildPathLabel(string id, string acId, string routeKey, string from, string to, string mode, int laneCount)
    {
        string route = !string.IsNullOrWhiteSpace(routeKey) ? routeKey : from + "->" + to;
        string owner = string.IsNullOrWhiteSpace(acId) ? "connection" : acId;
        string lanes = laneCount > 1 ? laneCount + " lanes" : "unified";
        return id + "  |  " + owner + "  |  " + route + "  |  " + mode + "  |  " + lanes;
    }

    private static string Value(JToken token)
    {
        return token == null ? string.Empty : token.Value<string>() ?? string.Empty;
    }

    private static string CleanName(string name)
    {
        return string.IsNullOrWhiteSpace(name) ? "(unnamed)" : name.Replace("·", "-");
    }
}
#endif
