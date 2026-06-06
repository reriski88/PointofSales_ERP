import 'package:flutter/material.dart';
import 'package:pos_cemilan_kasir/core/theme/app_palette.dart';
import 'package:pos_cemilan_kasir/features/home/pages/pos_shell_page.dart';

class PosCemilanApp extends StatelessWidget {
  const PosCemilanApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Smart POS ERP Kasir',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        visualDensity: VisualDensity.adaptivePlatformDensity,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppPalette.blue,
          primary: AppPalette.blue,
          secondary: AppPalette.amber,
          tertiary: AppPalette.red,
          surface: AppPalette.ivory,
          error: AppPalette.red,
        ),
        scaffoldBackgroundColor: AppPalette.ivory,
        appBarTheme: const AppBarTheme(
          backgroundColor: AppPalette.ivory,
          foregroundColor: AppPalette.navy,
          elevation: 0,
          centerTitle: false,
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppPalette.white,
          indicatorColor: AppPalette.aqua,
          labelTextStyle: WidgetStateProperty.all(
            const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        navigationRailTheme: const NavigationRailThemeData(
          backgroundColor: AppPalette.white,
          selectedIconTheme: IconThemeData(color: AppPalette.blue),
          selectedLabelTextStyle: TextStyle(
            color: AppPalette.blue,
            fontWeight: FontWeight.w800,
          ),
        ),
        cardTheme: const CardThemeData(
          elevation: 0,
          color: AppPalette.white,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
            side: BorderSide(color: AppPalette.line),
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: AppPalette.white,
          contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
            borderSide: BorderSide(color: AppPalette.line),
          ),
          isDense: true,
        ),
        chipTheme: ChipThemeData(
          backgroundColor: AppPalette.mist,
          selectedColor: AppPalette.aqua,
          side: const BorderSide(color: AppPalette.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          labelStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
        segmentedButtonTheme: SegmentedButtonThemeData(
          style: ButtonStyle(
            shape: WidgetStateProperty.all(
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            minimumSize: const Size(44, 44),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            minimumSize: const Size(44, 44),
          ),
        ),
      ),
      home: const PosShell(),
    );
  }
}
