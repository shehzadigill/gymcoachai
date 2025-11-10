import React from 'react';
import {View, Text, Pressable, ScrollView, StyleSheet} from 'react-native';
import {Icon} from './Icon';

interface Tab {
  id: string;
  title: string;
  icon: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabPress: (tabId: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabPress,
}) => {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        style={styles.scrollView}
        nestedScrollEnabled={true}
        scrollEnabled={true}>
        {tabs.map(tab => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => {
              console.log(`Tab pressed: ${tab.id}`);
              onTabPress(tab.id);
            }}
            hitSlop={{top: 10, bottom: 10, left: 5, right: 5}}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${tab.title} tab`}
            accessibilityState={{selected: activeTab === tab.id}}
            accessibilityHint={`Switches to ${tab.title} section`}>
            <Icon
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? '#3b82f6' : '#6b7280'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText,
              ]}
              numberOfLines={1}>
              {tab.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    zIndex: 10,
  },
  scrollView: {
    paddingHorizontal: 20,
  },
  scrollContainer: {
    paddingRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    minWidth: 80,
    minHeight: 44, // Minimum touch target size
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
    flexShrink: 1,
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default TabBar;
